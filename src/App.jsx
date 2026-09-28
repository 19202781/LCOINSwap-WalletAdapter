import { useEffect, useMemo, useState } from 'react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import {
  ConnectionProvider,
  WalletProvider,
  useWallet,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  CoinbaseWalletAdapter,
} from '@solana/wallet-adapter-wallets';

const DEFAULT_INPUT_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DEFAULT_OUTPUT_MINT = 'So11111111111111111111111111111111111111112';
const connection = new Connection(clusterApiUrl('mainnet-beta'));

async function getTokenBalance(publicKey, mintAddress) {
  try {
    const owner = new PublicKey(publicKey);
    const mint = new PublicKey(mintAddress);

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(owner, {
      mint,
    });

    if (!tokenAccounts.value.length) return 0;

    const parsed = tokenAccounts.value[0].account.data.parsed.info;
    const decimals = parsed.tokenAmount.decimals;
    const amount = parsed.tokenAmount.amount;

    return Number(amount) / 10 ** decimals;
  } catch (error) {
    console.error('Error fetching token balance:', error);
    return 0;
  }
}

async function validateFundsBeforeSwap(publicKey, inputMint, amountString) {
  const amount = Number(amountString);

  if (!publicKey || !inputMint || Number.isNaN(amount) || amount <= 0) {
    return {
      ok: false,
      message: 'Debes ingresar un monto válido y una wallet conectada.',
    };
  }

  const balance = await getTokenBalance(publicKey, inputMint);

  if (balance < amount) {
    return {
      ok: false,
      message: `Fondos insuficientes. Tienes ${balance.toFixed(6)} y necesitas ${amount.toFixed(6)}.`,
      available: balance,
      required: amount,
    };
  }

  return {
    ok: true,
    message: 'El usuario tiene fondos suficientes para realizar el swap.',
    available: balance,
    required: amount,
  };
}

async function getJupiterQuote({ inputMint, outputMint, amount, userPublicKey, slippageBps = 50 }) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps),
    onlyDirectRoutes: 'false',
    asLegacyTransaction: 'true',
    userPublicKey,
  });

  const response = await fetch(`https://api.jup.ag/v1/quote?${params.toString()}`);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Error obteniendo quote: ${text}`);
  }

  return response.json();
}

async function executeJupiterSwap({ quoteResponse, walletPublicKey }) {
  const res = await fetch('https://api.jup.ag/v1/swap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(import.meta.env.VITE_JUPITER_API_KEY
        ? { Authorization: `Bearer ${import.meta.env.VITE_JUPITER_API_KEY}` }
        : {}),
    },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey: walletPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error ejecutando swap: ${text}`);
  }

  return res.json();
}

function SwapForm() {
  const { publicKey, connected } = useWallet();
  const [inputMint, setInputMint] = useState(DEFAULT_INPUT_MINT);
  const [outputMint, setOutputMint] = useState(DEFAULT_OUTPUT_MINT);
  const [amount, setAmount] = useState('1000000');
  const [quote, setQuote] = useState(null);
  const [swapResult, setSwapResult] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessage('');
    setQuote(null);
    setSwapResult(null);
  }, [inputMint, outputMint, amount]);

  const handleGetQuote = async () => {
    if (!connected || !publicKey) {
      setMessage('Conecta tu wallet antes de intentar un swap.');
      return;
    }

    setLoading(true);
    setMessage('');
    setQuote(null);
    setSwapResult(null);

    try {
      const fundsCheck = await validateFundsBeforeSwap(publicKey.toString(), inputMint, amount);

      if (!fundsCheck.ok) {
        setMessage(fundsCheck.message);
        setLoading(false);
        return;
      }

      const quoteData = await getJupiterQuote({
        inputMint,
        outputMint,
        amount: Number(amount),
        userPublicKey: publicKey.toString(),
      });

      setQuote(quoteData);
      setMessage(`Quote obtenida correctamente. Saldo disponible: ${fundsCheck.available}`);
    } catch (error) {
      setMessage(error.message || 'Error al obtener la quote.');
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    if (!connected || !publicKey) {
      setMessage('Primero conecta tu wallet.');
      return;
    }

    if (!quote) {
      setMessage('Primero genera una quote válida.');
      return;
    }

    setLoading(true);
    setMessage('Ejecutando swap en Jupiter...');

    try {
      const result = await executeJupiterSwap({
        quoteResponse: quote,
        walletPublicKey: publicKey.toString(),
      });

      setSwapResult(result);
      setMessage('Swap ejecutado correctamente.');
    } catch (error) {
      setMessage(error.message || 'Error al ejecutar el swap.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="swap-panel">
      <div className="wallet-row">
        <WalletMultiButton />
      </div>

      <div className="form-grid">
        <label>
          Token de entrada (Mint)
          <input value={inputMint} onChange={(e) => setInputMint(e.target.value)} />
        </label>

        <label>
          Token de salida (Mint)
          <input value={outputMint} onChange={(e) => setOutputMint(e.target.value)} />
        </label>

        <label>
          Monto en unidades base
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
      </div>

      <div className="actions">
        <button onClick={handleGetQuote} disabled={loading || !connected}>
          {loading ? 'Procesando...' : 'Validar fondos y obtener quote'}
        </button>

        <button className="secondary" onClick={handleSwap} disabled={loading || !quote || !connected}>
          Ejecutar swap
        </button>
      </div>

      {message && <div className="message-box">{message}</div>}

      {quote && (
        <div className="quote-box">
          <h3>Quote</h3>
          <pre>{JSON.stringify(
            {
              inputMint: quote.inputMint,
              outputMint: quote.outputMint,
              inAmount: quote.inAmount,
              outAmount: quote.outAmount,
              otherAmountThreshold: quote.otherAmountThreshold,
            },
            null,
            2
          )}</pre>
        </div>
      )}

      {swapResult && (
        <div className="quote-box success-box">
          <h3>Resultado del swap</h3>
          <pre>{JSON.stringify(swapResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new CoinbaseWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={clusterApiUrl('mainnet-beta')}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <div className="app-shell">
            <header className="topbar">
              <div>
                <p className="eyebrow">LCOINSwap</p>
                <h1>WalletAdapter + Jupiter</h1>
              </div>
            </header>

            <SwapForm />
          </div>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

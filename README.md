# LCOINSwap WalletAdapter + Jupiter

Este repositorio contiene una base funcional para integrar una wallet de Solana usando WalletAdapter y ejecutar un swap con Jupiter.

## Características

- Conexión con wallet Solana usando WalletAdapter
- Validación de fondos del usuario antes del swap
- Obtención de quote desde Jupiter
- Ejecución del swap usando la API de Jupiter
- Entorno React + Vite

## Requisitos

- Node.js 18+
- npm
- Una wallet de Solana como Phantom o Solflare

## Instalación

```bash
npm install
```

## Variables de entorno

Copia el archivo `.env.example` a `.env` y agrega tu configuración:

```bash
cp .env.example .env
```

Ejemplo:

```env
VITE_JUPITER_API_KEY=
VITE_JUPITER_RPC_URL=https://api.mainnet-beta.solana.com
```

## Ejecutar la app

```bash
npm run dev
```

## Flujo de uso

1. Conecta tu wallet.
2. Ingresa el mint del token de entrada y salida.
3. Escribe el monto.
4. Se valida si el usuario tiene fondos suficientes.
5. Si pasa la validación, se obtiene una quote de Jupiter.
6. Se ejecuta el swap con Jupiter.

## Importante

- El monto debe estar en unidades base del token.
- Para USDC, 1 USDC = `1000000` en unidades base.
- Debes ajustar los valores según el mint y los decimales reales del token.

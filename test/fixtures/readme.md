# Payments Service

Handles charge capture, refunds, and webhook reconciliation.

## Installation

```bash
npm install @acme/payments
```

## Configuration

Set `PAYMENTS_API_KEY` before booting.

### Environment variables

| Name | Required | Default |
|------|----------|---------|
| `PAYMENTS_API_KEY` | yes | — |
| `PAYMENTS_TIMEOUT_MS` | no | `5000` |

## Usage

```js
const { capture } = require('@acme/payments');
await capture({ amount: 500, currency: 'eur' });
```

## Webhooks

### Signature verification

Every webhook carries an `X-Signature` header.

### Retry policy

Failed deliveries retry with exponential backoff.

## Troubleshooting

See the runbook.

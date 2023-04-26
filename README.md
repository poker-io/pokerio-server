# pokerio-server

[![Build](https://github.com/poker-io/pokerio-server/actions/workflows/main.yml/badge.svg)](https://github.com/poker-io/pokerio-server/blob/main/.github/workflows/main.yml)
[![Lint](https://github.com/poker-io/pokerio-server/actions/workflows/eslint.yml/badge.svg)](https://github.com/poker-io/pokerio-server/blob/main/.github/workflows/eslint.yml)
[![Prettier](https://github.com/poker-io/pokerio-server/actions/workflows/prettier.yml/badge.svg)](https://github.com/poker-io/pokerio-server/blob/main/.github/workflows/prettier.yml)
[![Tests](https://github.com/poker-io/pokerio-server/actions/workflows/test.yml/badge.svg)](https://github.com/poker-io/pokerio-server/blob/main/.github/workflows/test.yml)
[![codecov](https://codecov.io/gh/poker-io/pokerio-server/branch/main/graph/badge.svg?token=4QCZNOWFZJ)](https://codecov.io/gh/poker-io/pokerio-server)

## Requirements

Make sure you're using node version 18 or newer. To install the appropriate
version follow the instructions on nodejs.org.

To install dependencies run:

```
yarn install
```

## Running

First you have to add firebase service account json file in src/ as serviceAccount.json.

Run `yarn start`.

## Testing

We use Jest for testing. To run it, simply type `yarn test`.

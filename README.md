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

Remember to add the `serviceAccount.json` file from Firebase under `src/` as
well as a `secrets.ts` file that contains login credentials for the database.
It should be similar to this:

```ts
export const user = 'pokerio-user'
export const password = 'pokerio-password'
```

## Running

Run `yarn start`.

The app will attempt to connect to a Postgres database using the details
provided in `databaseConnection.ts`.

## Testing

We use Jest for testing. To run it, simply type `yarn test`.

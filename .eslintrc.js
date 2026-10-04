// Layer boundaries by file role: `*.controller.ts` -> `*.service.ts` -> `*.repository.ts`.
// Matches `src/...`, `./x` and `../x` imports of any depth.
const forbid = (roles, message) => ({
  group: roles.flatMap((role) => [`*.${role}`, `**/*.${role}`]),
  message,
});
const boundary = (files, patterns) => ({
  files,
  excludedFiles: ['**/*.spec.ts'],
  rules: { 'no-restricted-imports': ['error', { patterns }] },
});

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
  //  'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'local_dev'],
  overrides: [
    boundary(['src/**/*.controller.ts'], [forbid(['repository'], 'Controllers must go through a service, not import a repository.')]),
    boundary(['src/**/*.service.ts'], [forbid(['controller'], 'Services must not depend on controllers.')]),
    boundary(['src/**/*.repository.ts'], [
      forbid(['controller'], 'Repositories must not depend on controllers.'),
      forbid(['service'], 'Repositories must not depend on services (known violations are tracked in the eslint baseline).'),
    ]),
    boundary(['src/utils/**/*.ts'], [forbid(['controller', 'service', 'repository'], 'Utils are shared by every module and must not depend on controllers, services or repositories.')]),
  ],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
    'require-await': 'off',
    '@typescript-eslint/require-await': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
  },
};

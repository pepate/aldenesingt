# Firebase Studio Next.js Starter

This is a Next.js starter project bootstrapped in Firebase Studio. It's configured with Next.js, TypeScript, Tailwind CSS, ShadCN UI, and Firebase.

## Getting Started

To get started with development, run the development server:

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

You can start editing the main page by modifying `src/app/page.tsx`.

## Git and Version Control

This project is ready to be used with Git.

### Ignoring Files

A `.gitignore` file is included to prevent sensitive and unnecessary files from being committed to your repository. This includes:

-   `node_modules/`: All installed dependencies.
-   `.next/`: The Next.js build output.
-   `.env` and `.env.local`: Local environment variable files. **NEVER commit these files.**

### Environment Variables

Sensitive information, like API keys, should be stored in environment variables.

1.  Create a `.env.local` file in the root of your project.
2.  Add your environment variables to this file, for example:

    ```
    NEXT_PUBLIC_FIREBASE_CONFIG={...}
    ```

Any variables prefixed with `NEXT_PUBLIC_` will be exposed to the browser. The `.env.local` file is already listed in `.gitignore`, so it will not be committed to your repository.

# Aldene Singt - Next.js & Firebase

This is a Next.js project bootstrapped in Firebase Studio, designed for real-time, collaborative lyric and chord sheet viewing for musicians. It's configured with Next.js, TypeScript, Tailwind CSS, ShadCN UI, Firebase (Auth, Firestore), and Genkit for AI features.

## Getting Started

To get started with local development, run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) with your browser to see the result.

## Configuration

Before you can run or deploy the application, you need to configure your Firebase project settings.

### 1. Firebase Project

This application requires a Firebase project to function. All backend services (Authentication, Firestore Database) are managed through Firebase.

### 2. Environment Variables

Sensitive information, like your Firebase configuration, is managed through environment variables.

1.  **Create a `.env.local` file** in the root of your project. This file is ignored by Git and should never be committed to your repository.
2.  **Get your Firebase Config:**
    *   Go to your [Firebase Console](https://console.firebase.google.com/).
    *   Select your project.
    *   In the project overview, click the `</>` (Web) icon to find your web app's configuration.
    *   Copy the `firebaseConfig` object.
3.  **Add to `.env.local`:** Paste the configuration into your `.env.local` file, ensuring it's a single line of JSON:

    ```
    NEXT_PUBLIC_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
    ```

    Any variables prefixed with `NEXT_PUBLIC_` will be exposed to the browser, which is safe and necessary for the Firebase client-side SDK.

### 3. AI Features (Genkit)

The AI features for generating song sheets (`generate-song-sheet-flow.ts`) use Google's Generative AI models via Genkit.

*   **Billing Required:** To use these features in production, you must have **Billing enabled** on the underlying Google Cloud project associated with your Firebase project.
*   **API Key:** Genkit will automatically use Application Default Credentials in the Firebase App Hosting environment. For local development, you may need to set up authentication via the `gcloud` CLI:
    ```bash
    gcloud auth application-default login
    ```

## Deployment with Firebase App Hosting

This project is pre-configured for easy deployment using Firebase App Hosting.

### 1. Install Firebase CLI

If you haven't already, install the Firebase command-line tools:

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

Log in to your Google account:

```bash
firebase login
```

### 3. Initialize App Hosting

In your project directory, associate your local project with your Firebase project:

```bash
# It will ask you to select a project. Choose the one you configured above.
# When asked about the hosting backend, select the region where you want to deploy.
firebase apphosting:backends:create
```

This will create or update your `apphosting.yaml` and connect your local repository to a backend on App Hosting.

### 4. Deploy

To deploy your application, run the following command:

```bash
firebase deploy --only apphosting
```

Firebase will build your Next.js application and deploy it to a secure, scalable serverless environment. Your application will be available at the URL provided after the deployment finishes.

---

## Git and Version Control

This project is ready to be used with Git.

### Ignoring Files

A `.gitignore` file is included to prevent sensitive and unnecessary files from being committed to your repository. This includes:

-   `node_modules/`: All installed dependencies.
-   `.next/`: The Next.js build output.
-   `.env` and `.env.local`: Local environment variable files. **NEVER commit these files.**
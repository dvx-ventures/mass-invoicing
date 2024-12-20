import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "./firebaseConfig"; // Make sure this is the correct path

function AppWrapper() {
  const [authInitialized, setAuthInitialized] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, () => {
      // Once this fires, Firebase has finished checking for a persisted session.
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  if (!authInitialized) {
    // Show a loading indicator until auth state is resolved
    return <div>Loading...</div>;
  }

  return <App />;
}

const container = document.getElementById("root") as HTMLElement;
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <AppWrapper />
  </React.StrictMode>
);

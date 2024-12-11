import {
  Authenticated,
  AuthBindings,
  Refine,
} from "@refinedev/core";
import { DevtoolsPanel, DevtoolsProvider } from "@refinedev/devtools";
import { RefineKbar, RefineKbarProvider } from "@refinedev/kbar";
import { doc, getDoc } from 'firebase/firestore';
import {
  ErrorComponent,
  RefineSnackbarProvider,
  ThemedLayoutV2,
} from "@refinedev/mui";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import routerBindings, {
  CatchAllNavigate,
  DocumentTitleHandler,
  NavigateToResource,
  UnsavedChangesNotifier,
} from "@refinedev/react-router-v6";
import axios from "axios";
import { BrowserRouter, Outlet, Route, Routes } from "react-router-dom";
import { AppIcon } from "./components/app-icon";
import { Header } from "./components/header";
import { ColorModeContextProvider } from "./contexts/color-mode";
import { CredentialResponse } from "./interfaces/google";
import {
  InvoiceCreate,
  InvoiceEdit,
  InvoiceList,
  InvoiceShow,
} from "./pages/invoice";
import Login from "./pages/login";
import { parseJwt } from "./utils/parse-jwt";
import { firebaseAuth, firestoreDatabase, firestore, app } from "./firebaseConfig";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { FirestoreDatabase } from "refine-firebase";

const axiosInstance = axios.create();

axiosInstance.interceptors.request.use(async (config) => {
  const token = await firebaseAuth.currentUser?.getIdToken();
  if (config.headers && token) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const authProvider: AuthBindings = {
    login: async ({ email, password, providerName }): Promise<{
      success: boolean;
      redirectTo?: string;
      error?: { message: string; name: string };
    }> => {
      try {
        let userCredential;
        if (providerName === "google") {
          const provider = new GoogleAuthProvider();
          userCredential = await signInWithPopup(firebaseAuth, provider);
        } else if (email && password) {
          userCredential = await signInWithEmailAndPassword(
            firebaseAuth,
            email,
            password
          );
        } else {
          return {
            success: false,
            error: {
              message: "Invalid login credentials",
              name: "LoginError",
            },
          };
        }

        const user = userCredential.user;
        const token = await user.getIdToken();

        localStorage.setItem("token", token);
        localStorage.setItem("user", JSON.stringify(user));

        return {
          success: true,
          redirectTo: "/",
        };
      } catch (error: any) {
        return {
          success: false,
          error: {
            message: error.message,
            name: error.code,
          },
        };
      }
    },

    logout: async (): Promise<{
      success: boolean;
      redirectTo?: string;
      error?: { message: string; name: string };
    }> => {
      try {
        await signOut(firebaseAuth);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        return {
          success: true,
          redirectTo: "/login",
        };
      } catch (error: any) {
        return {
          success: false,
          error: {
            message: error.message,
            name: error.code,
          },
        };
      }
    },

    check: async () => {
      try {
        const user = firebaseAuth.currentUser;
        console.log("user:", user?.email);
        if (user) {
          // Reference to the user document in Firestore
          const userDocRef = doc(firestore, 'user', user.uid);
          console.log("userDocRef:", userDocRef);
          const userDoc = await getDoc(userDocRef);
          console.log("userDoc:", userDoc.id);
          console.log("userDoc:", userDoc?.data()?.email);
          if (userDoc.exists()) {
            // User document exists, authentication successful
            console.log("user doc exists");
            return { authenticated: true };
          } else {
            // User document does not exist, sign out and redirect to login
            console.log("user doc DOES NOT exist");
            await signOut(firebaseAuth);
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            return {
              authenticated: false,
              error: {
                message: 'User not authorized',
                name: 'AuthError',
              },
              logout: true,
              redirectTo: '/login',
            };
          }
        } else {
          // No user is currently authenticated
          return {
            authenticated: false,
            error: {
              message: 'User not authenticated',
              name: 'AuthError',
            },
            logout: true,
            redirectTo: '/login',
          };
        }
      } catch (error: any) {
        console.error('Auth check error:', error);
        return {
          authenticated: false,
          error: {
            message: 'Authentication check failed',
            name: 'AuthError',
          },
          logout: true,
          redirectTo: '/login',
        };
      }
    },

    getIdentity: async (): Promise<{
      id: string;
      email: string | null;
      name: string | null;
      avatar: string | null;
    } | null> => {
      const user = firebaseAuth.currentUser;
      if (user) {
        return {
          id: user.uid,
          email: user.email,
          name: user.displayName,
          avatar: user.photoURL,
        };
      }
      return null;
    },

    onError: async (error: any): Promise<{ error: any }> => {
      console.error(error);
      return { error };
    },

    getPermissions: async () => null,
  };

  return (
    <BrowserRouter>
      <RefineKbarProvider>
        <ColorModeContextProvider>
          <CssBaseline />
          <GlobalStyles styles={{ html: { WebkitFontSmoothing: "auto" } }} />
          <RefineSnackbarProvider>
            <DevtoolsProvider>
              <Refine
                dataProvider={firestoreDatabase.getDataProvider()}
                authProvider={authProvider}
                routerProvider={routerBindings}
                resources={[
                  {
                    name: "invoice",
                    list: InvoiceList,
                    create: InvoiceCreate,
                    edit: InvoiceEdit,
                    show: InvoiceShow,
                    meta: {
                      canDelete: true,
                    },
                  },
                ]}
                options={{
                  syncWithLocation: true,
                  warnWhenUnsavedChanges: true,
                  useNewQueryKeys: true,
                  projectId: "iYw4rT-BiqRmU-uKPitj",
                  title: { text: "Mass Portal", icon: <AppIcon /> },
                }}
              >
                <Routes>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-inner"
                        fallback={<CatchAllNavigate to="/login" />}
                      >
                        <ThemedLayoutV2 Header={Header}>
                          <Outlet />
                        </ThemedLayoutV2>
                      </Authenticated>
                    }
                  >
                    <Route
                      index
                      element={<NavigateToResource resource="invoice" />}
                    />
                    <Route path="/invoice">
                      <Route index element={<InvoiceList />} />
                      <Route path="create" element={<InvoiceCreate />} />
                      <Route path="edit/:id" element={<InvoiceEdit />} />
                      <Route path="show/:id" element={<InvoiceShow />} />
                    </Route>
                    <Route path="*" element={<ErrorComponent />} />
                  </Route>
                  <Route
                    element={
                      <Authenticated
                        key="authenticated-outer"
                        fallback={<Outlet />}
                      >
                        <NavigateToResource />
                      </Authenticated>
                    }
                  >
                    <Route path="/login" element={<Login />} />
                  </Route>
                </Routes>

                <RefineKbar />
                <UnsavedChangesNotifier />
                <DocumentTitleHandler />
              </Refine>
              <DevtoolsPanel />
            </DevtoolsProvider>
          </RefineSnackbarProvider>
        </ColorModeContextProvider>
      </RefineKbarProvider>
    </BrowserRouter>
  );
}

export default App;

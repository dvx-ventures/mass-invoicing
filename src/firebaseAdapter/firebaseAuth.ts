import { FirebaseApp } from "@firebase/app";
import { AuthProvider,AuthActionResponse } from "@refinedev/core";
import { Auth, inMemoryPersistence, browserLocalPersistence, browserSessionPersistence, createUserWithEmailAndPassword, getAuth, getIdTokenResult, ParsedToken, RecaptchaParameters, RecaptchaVerifier, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateEmail, updatePassword, updateProfile, User as FirebaseUser } from "firebase/auth";
import { IAuthCallbacks, ILoginArgs, IRegisterArgs, IUser } from "./interfaces";
import { detectPlatform } from "./helpers/detectPlatform";

export class FirebaseAuth {
    auth: Auth;

    constructor (
        private readonly authActions?: IAuthCallbacks,
        firebaseApp?: FirebaseApp,
        auth?: Auth
    ) {
        this.auth = auth || getAuth(firebaseApp);
        this.auth.useDeviceLanguage();

        this.getAuthProvider = this.getAuthProvider.bind(this);
        this.handleLogIn = this.handleLogIn.bind(this);
        this.handleRegister = this.handleRegister.bind(this);
        this.handleLogOut = this.handleLogOut.bind(this);
        this.handleResetPassword = this.handleResetPassword.bind(this);
        this.onUpdateUserData = this.onUpdateUserData.bind(this);
        this.getUserIdentity = this.getUserIdentity.bind(this);
        this.handleCheck = this.handleCheck.bind(this);
        this.createRecaptcha = this.createRecaptcha.bind(this);
        this.getPermissions = this.getPermissions.bind(this);
    }

    public async handleLogOut(): Promise<AuthActionResponse> {
        try {
            await signOut(this.auth);
            await this.authActions?.onLogout?.(this.auth);
    
            return { success: true };
        } catch (error) {
            return Promise.reject(error);
        }
    }

    public async handleRegister(args: IRegisterArgs) {
        try {
            const { email, password, displayName } = args;

            const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
            await sendEmailVerification(userCredential.user);
            if (userCredential.user) {
                if (displayName) {
                    await updateProfile(userCredential.user, { displayName });
                }
                this.authActions?.onRegister?.(userCredential.user);
            }

        } catch (error) {
            return Promise.reject(error);
        }
    }

    public async handleLogIn({ email, password, remember }: ILoginArgs): Promise<AuthActionResponse> {
        try {
            // existing logic...
            let persistance = browserSessionPersistence;
    
            if (detectPlatform() === "react-native") {
                persistance = inMemoryPersistence;
            } else if (remember) {
                persistance = browserLocalPersistence;
            }
    
            await this.auth.setPersistence(persistance);
            const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
    
            // If successful:
            return {
                success: true,
                // optionally you can redirect or return more data
                // redirectTo: "/dashboard",
            };
    
        } catch (error) {
            // Use `Promise.reject(...)` to signal the error to Refine
            return Promise.reject(error);
        }
    }

    public handleResetPassword(email: string) {
        return sendPasswordResetEmail(this.auth, email);
    }

    public async onUpdateUserData(args: IRegisterArgs) {

        try {
            if (this.auth?.currentUser) {
                const { displayName, email, password } = args;
                if (password) {
                    await updatePassword(this.auth.currentUser, password);
                }

                if (email && this.auth.currentUser.email !== email) {
                    await updateEmail(this.auth.currentUser, email);
                }

                if (displayName && this.auth.currentUser.displayName !== displayName) {
                    await updateProfile(this.auth.currentUser, { displayName: displayName });
                }
            }
        } catch (error) {
            return Promise.reject(error);
        }
    }

    private async getUserIdentity(): Promise<IUser> {
        const user = this.auth?.currentUser;
        return {
            ...this.auth.currentUser,
            email: user?.email || "",
            name: user?.displayName || ""
        };
    }

    private getFirebaseUser(): Promise<FirebaseUser> {
        return new Promise<FirebaseUser>((resolve, reject) => {
            const unsubscribe = this.auth?.onAuthStateChanged(user => {
                unsubscribe();
                resolve(user as FirebaseUser | PromiseLike<FirebaseUser>);
            }, reject);
        });
    }

    private async handleCheck(): Promise<{
        authenticated: boolean;
        redirectTo?: string;
        error?: any;
    }> {
        const user = await this.getFirebaseUser();
        if (user) {
            return { authenticated: true };
        } else {
            return {
                authenticated: false,
                redirectTo: "/login",
            };
        }
    }

    public async getPermissions(): Promise<ParsedToken> {
        if (this.auth?.currentUser) {
            const idTokenResult = await getIdTokenResult(this.auth.currentUser);
            return idTokenResult?.claims;
        } else {
            return Promise.reject(new Error("User is not found"));
        }
    }

    public createRecaptcha(
        containerOrId: string | HTMLDivElement,
        parameters?: RecaptchaParameters,
    ) {
        return new RecaptchaVerifier(this.auth, containerOrId, parameters);
    }

    public getAuthProvider(): AuthProvider {
        return {
            login: this.handleLogIn,
            logout: this.handleLogOut,
            check: this.handleCheck,
            onError: () => Promise.resolve({}),
            getPermissions: this.getPermissions,
            getIdentity: this.getUserIdentity,
        };
    }
}

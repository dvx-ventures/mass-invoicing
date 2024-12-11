import { useLogin } from "@refinedev/core";
import { useState } from "react";

import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { ThemedTitleV2 } from "@refinedev/mui";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

// TODO: Update your Google Client ID here
const GOOGLE_CLIENT_ID =
  "790780927928-il7cdlauco53dhaif2mooakff6v3kdia.apps.googleusercontent.com";

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { mutate: login } = useLogin();

  const handleEmailLogin = () => {
    login({ email, password });
  };

  const handleGoogleLogin = () => {
    login({ providerName: "google" });
  };

  return (
    <Container maxWidth="xs">
      <Box
        mt={8}
        display="flex"
        flexDirection="column"
        alignItems="center"
        boxShadow={3}
        p={4}
        borderRadius={2}
      >
        <ThemedTitleV2 collapsed={false} />

        <Typography component="h1" variant="h5" gutterBottom>
          Sign in to your account
        </Typography>
        <Box component="form" width="100%" mt={1}>
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            variant="outlined"
            margin="normal"
            required
            fullWidth
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            type="button"
            fullWidth
            variant="contained"
            color="primary"
            onClick={handleEmailLogin}
            sx={{ mt: 3, mb: 2 }}
          >
            Sign In
          </Button>
          <Button
            type="button"
            fullWidth
            variant="outlined"
            color="secondary"
            onClick={handleGoogleLogin}
          >
            Sign In with Google
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default Login;

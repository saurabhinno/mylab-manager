"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container, Paper, Typography, TextField, Button, Alert, Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { apiRequest } from "@/lib/api";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("compounder");
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const response = await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, role }),
    });

    const result = await response.json();
    if (response.ok) {
      setMessage("Registration complete. Redirecting to login...");
      router.push("/login");
    } else {
      setMessage(result.error || "Registration failed.");
    }
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Register
        </Typography>
        {message && (
          <Alert severity={message.includes("complete") ? "success" : "error"} sx={{ mb: 2 }}>
            {message}
          </Alert>
        )}
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            fullWidth
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select value={role} onChange={(event) => setRole(event.target.value)}>
              <MenuItem value="compounder">Compounder</MenuItem>
              <MenuItem value="doctor">Doctor</MenuItem>
            </Select>
          </FormControl>
          <Button type="submit" variant="contained" fullWidth>
            Register
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

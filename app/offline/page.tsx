"use client";

import { Box, Typography } from "@mui/material";
import { WifiOffOutlined } from "@mui/icons-material";

export default function OfflinePage() {
  return (
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f4c81 0%, #1565c0 100%)",
      color: "#fff",
      textAlign: "center",
      p: 3,
    }}>
      <WifiOffOutlined sx={{ fontSize: 64, mb: 2, opacity: 0.8 }} />
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>You're Offline</Typography>
      <Typography variant="body1" sx={{ opacity: 0.8 }}>
        Check your internet connection and try again.
      </Typography>
    </Box>
  );
}

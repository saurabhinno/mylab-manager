import Link from "next/link";
import { Box, Typography, Button } from "@mui/material";
import { LocalHospitalOutlined, ArrowForwardOutlined } from "@mui/icons-material";

export default function Home() {
  return (
    <Box sx={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #0f4c81 0%, #1565c0 50%, #00897b 100%)",
      color: "#fff",
      textAlign: "center",
      px: 3,
    }}>
      <Box sx={{ mb: 3, width: 80, height: 80, borderRadius: 4, bgcolor: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <LocalHospitalOutlined sx={{ fontSize: 44 }} />
      </Box>
      <Typography variant="h2" sx={{ fontWeight: 800, mb: 1 }}>MyLab</Typography>
      <Typography variant="h5" sx={{ fontWeight: 400, opacity: 0.85, mb: 1 }}>Diagnostics Portal</Typography>
      <Typography sx={{ opacity: 0.65, mb: 5, maxWidth: 420 }}>
        Streamlined blood test reporting for doctors and lab staff.
      </Typography>
      <Button
        variant="contained"
        component={Link}
        href="/login"
        endIcon={<ArrowForwardOutlined />}
        size="large"
        sx={{
          bgcolor: "#fff", color: "#0f4c81", fontWeight: 700,
          px: 4, py: 1.5, borderRadius: 3,
          "&:hover": { bgcolor: "#f0f4f8" },
          background: "#fff",
        }}
      >
        Sign In
      </Button>
    </Box>
  );
}

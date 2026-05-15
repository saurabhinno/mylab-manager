'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Avatar, Tooltip,
} from '@mui/material';
import {
  DashboardOutlined, ScienceOutlined, ArticleOutlined,
  PeopleOutlined, LogoutOutlined, LocalHospitalOutlined, PersonOutlined, SettingsOutlined,
} from '@mui/icons-material';
import { apiRequest } from '@/lib/api';

const DRAWER_WIDTH = 240;

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const doctorNav: NavItem[] = [
  { label: 'Dashboard', href: '/doctor/dashboard', icon: <DashboardOutlined /> },
  { label: 'Test Catalogue', href: '/doctor/tests', icon: <ScienceOutlined /> },
  { label: 'All Reports', href: '/doctor/reports', icon: <ArticleOutlined /> },
  { label: 'Staff', href: '/doctor/staff', icon: <PeopleOutlined /> },
  { label: 'Report Settings', href: '/doctor/settings', icon: <SettingsOutlined /> },
  { label: 'Profile', href: '/doctor/profile', icon: <PersonOutlined /> },
];

const compounderNav: NavItem[] = [
  { label: 'Reports', href: '/compounder/reports', icon: <DashboardOutlined /> },
];

interface SidebarProps {
  role: 'doctor' | 'compounder';
  email?: string;
}

export default function Sidebar({ role, email }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const nav = role === 'doctor' ? doctorNav : compounderNav;

  async function handleLogout() {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          background: 'linear-gradient(180deg, #0f4c81 0%, #0d3d6b 100%)',
          color: '#fff',
          border: 'none',
        },
      }}
    >
      {/* Logo */}
      <Box sx={{ px: 2.5, py: 3, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 38, height: 38, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <LocalHospitalOutlined sx={{ color: '#fff', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
            MyLab
          </Typography>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 10 }}>
            Diagnostics Portal
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2 }} />

      {/* Nav */}
      <List sx={{ px: 1.5, pt: 2, flexGrow: 1 }}>
        {nav.map((item) => {
          const active = pathname === item.href;
          return (
            <ListItem key={item.href} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                sx={{
                  borderRadius: 2,
                  px: 1.5, py: 1,
                  color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                  background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                  '&:hover': { background: 'rgba(255,255,255,0.1)', color: '#fff' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: 'inherit' }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 14, fontWeight: active ? 600 : 400 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider sx={{ borderColor: 'rgba(255,255,255,0.12)', mx: 2 }} />

      {/* User */}
      <Box sx={{ px: 2, py: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
          {email?.[0]?.toUpperCase() ?? 'U'}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', fontSize: 10 }}>
            {role === 'doctor' ? 'Doctor' : 'Compounder'}
          </Typography>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 500, fontSize: 11, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email ?? ''}
          </Typography>
        </Box>
        <Tooltip title="Logout">
          <LogoutOutlined
            onClick={handleLogout}
            sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, cursor: 'pointer', '&:hover': { color: '#fff' } }}
          />
        </Tooltip>
      </Box>
    </Drawer>
  );
}

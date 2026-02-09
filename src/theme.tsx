import { createTheme } from '@mui/material/styles'
import darkScrollbar from '@mui/material/darkScrollbar'

// Flink brand colors extracted from https://flink.apache.org
const flink = {
    // Brand purple family
    purple: '#7A3587',
    purpleLight: '#C679D4',
    purpleHover: '#B26DBF',
    purplePressed: '#9E61AA',

    // Hero / wave gradient
    heroViolet: '#7573D1',

    // Dark navy family
    inkNavy: '#232F3E',
    deepNavy: '#17202C',
    dropdownDark: '#2a2e33',

    // Link blues
    linkBlue: '#0073BB',
    linkBlueHover: '#0A4A74',
    linkBlueDark: '#44B9D6',
    linkBlueDarkHover: '#99CBE4',

    // Neutrals
    offWhite: '#F2F3F3',
    borderLight: '#D5DBDB',
    borderDark: '#576F8C',
    codeBgLight: '#EAEDED',

    // Status
    info: '#66BBFF',
    warning: '#FFDD66',
    danger: '#FF6666',
}

const sharedComponents = {
    MuiButton: {
        styleOverrides: {
            root: {
                textTransform: 'none' as const,
                borderRadius: 10,
            },
        },
    },
    MuiIconButton: {
        styleOverrides: {
            root: {
                borderRadius: 10,
            },
        },
    },
    MuiTooltip: {
        styleOverrides: {
            tooltip: {
                borderRadius: 6,
            },
        },
    },
}

const typography = {
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
}

export const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: {
            main: flink.purple,
            light: flink.purpleLight,
            dark: flink.purplePressed,
        },
        secondary: {
            main: flink.purpleLight,
            light: '#D9A0E3',
            dark: flink.purpleHover,
        },
        background: {
            default: '#FFFFFF',
            paper: '#FFFFFF',
        },
        text: {
            primary: flink.inkNavy,
            secondary: '#5F6B7A',
        },
        divider: flink.borderLight,
        error: {
            main: flink.danger,
        },
        warning: {
            main: flink.warning,
        },
        info: {
            main: flink.linkBlue,
        },
        success: {
            main: '#4CAF50',
        },
        action: {
            hover: 'rgba(122, 53, 135, 0.06)',
            selected: 'rgba(122, 53, 135, 0.10)',
        },
    },
    typography,
    components: {
        ...sharedComponents,
        MuiLink: {
            styleOverrides: {
                root: {
                    color: flink.linkBlue,
                    textDecoration: 'none',
                    '&:hover': {
                        color: flink.linkBlueHover,
                    },
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    '&.Mui-selected': {
                        color: flink.purple,
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    backgroundColor: flink.purple,
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                standardError: {
                    backgroundColor: 'rgba(255, 102, 102, 0.1)',
                },
                standardWarning: {
                    backgroundColor: 'rgba(255, 221, 102, 0.1)',
                },
                standardInfo: {
                    backgroundColor: 'rgba(102, 187, 255, 0.1)',
                },
            },
        },
    },
})

export const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: {
            main: flink.purpleLight,
            light: '#D9A0E3',
            dark: flink.purple,
        },
        secondary: {
            main: flink.heroViolet,
            light: '#9997DD',
            dark: '#5B59B0',
        },
        background: {
            default: flink.inkNavy,
            paper: flink.deepNavy,
        },
        text: {
            primary: '#FFFFFF',
            secondary: '#B0BEC5',
        },
        divider: flink.borderDark,
        error: {
            main: flink.danger,
        },
        warning: {
            main: flink.warning,
        },
        info: {
            main: flink.linkBlueDark,
        },
        success: {
            main: '#66BB6A',
        },
        action: {
            hover: 'rgba(198, 121, 212, 0.10)',
            selected: 'rgba(198, 121, 212, 0.16)',
        },
    },
    typography,
    components: {
        ...sharedComponents,
        MuiLink: {
            styleOverrides: {
                root: {
                    color: flink.linkBlueDark,
                    textDecoration: 'none',
                    '&:hover': {
                        color: flink.linkBlueDarkHover,
                    },
                },
            },
        },
        MuiTab: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    '&.Mui-selected': {
                        color: flink.purpleLight,
                    },
                },
            },
        },
        MuiTabs: {
            styleOverrides: {
                indicator: {
                    backgroundColor: flink.purpleLight,
                },
            },
        },
        MuiAlert: {
            styleOverrides: {
                standardError: {
                    backgroundColor: 'rgba(255, 102, 102, 0.1)',
                },
                standardWarning: {
                    backgroundColor: 'rgba(255, 221, 102, 0.1)',
                },
                standardInfo: {
                    backgroundColor: 'rgba(102, 187, 255, 0.1)',
                },
            },
        },
        MuiCssBaseline: {
            styleOverrides: {
                body: darkScrollbar(),
            },
        },
    },
})

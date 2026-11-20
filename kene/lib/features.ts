export const FEATURES = {
  hospitals: process.env.NEXT_PUBLIC_ENABLE_HOSPITALS === "true",
  showDemoAccounts: process.env.NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS !== "false",
} as const;

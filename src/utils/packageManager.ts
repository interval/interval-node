export type PackageManager = 'npm' | 'yarn'

export function detectPackageManager(): PackageManager {
  const userAgent = process.env.npm_config_user_agent
  if (userAgent && userAgent.includes('yarn/')) {
    return 'yarn'
  }

  return 'npm'
}

export function getInstallCommand(
  packageName: string,
  packageManager: PackageManager
) {
  switch (packageManager) {
    case 'npm':
      return `npm install ${packageName}`
    case 'yarn':
      return `yarn add ${packageName}`
  }
}

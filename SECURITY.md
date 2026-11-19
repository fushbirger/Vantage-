Security Policy
Supported Versions

Vantage is currently under active development. Security updates are applied to the latest version available on the main branch.

Version	Supported
Latest (main)	Yes
Older versions	No
Reporting a Vulnerability

If you discover a potential security vulnerability in Vantage, please report it responsibly.

Please do not disclose security vulnerabilities through public GitHub Issues or Pull Requests.

Instead, use GitHub's private vulnerability reporting feature through the repository's Security tab, if available.

When submitting a report, please include:

A clear description of the vulnerability.
The affected component or file, if known.
Steps to reproduce the issue.
The potential security impact.
Any relevant screenshots or logs, with sensitive information removed.
Security Scope

The following areas are particularly important to Vantage:

Authentication and Sessions: Session management, cookie security, and authentication mechanisms.
Data Privacy: Protection of personal information, expense records, and financial details.
Payment Profiles: Security of tarus proxies, QR payment images, and Pocket payment links.
Ledger Integrity: Prevention of unauthorized expense modifications, settlement manipulation, and balance inconsistencies.
API Security: Access control, input validation, and authorization across API routes.
WhatsApp Integration: Webhook verification, API token protection, and notification security.
Database Security: Protection of SQLite databases and sensitive application data.
Secret Management: Prevention of accidental exposure of environment variables, credentials, and API tokens.
Responsible Disclosure

Please follow responsible disclosure practices:

Do not publicly disclose vulnerabilities before they have been addressed.
Do not access, modify, or delete other users' data.
Do not perform destructive testing or denial-of-service attacks.
Do not exploit vulnerabilities beyond what is necessary to demonstrate their impact.
Do not expose personal information, credentials, or sensitive financial data.
Security Considerations
Never commit API keys, access tokens, passwords, or production secrets to the repository.
Keep environment variables and deployment credentials private.
Use HTTPS when deploying Vantage in a production environment.
Configure WhatsApp webhook signature verification when using live integrations.
Do not use demo accounts or demo authentication for real financial data.
Review dependencies and apply security updates regularly.
Scope and Disclaimer

Vantage is a non-custodial expense tracking and payment coordination application. It does not hold user funds, operate a wallet, or directly process financial transactions.

Security reports concerning the application, its APIs, authentication, data storage, and integrations are welcome.

Vantage is an open-source project under active development. No specific response or remediation timeframe is guaranteed.

Thank you for helping keep Vantage and its users safe.
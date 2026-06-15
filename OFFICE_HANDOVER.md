# Mugnee CRM Office Handover

## Production URL

https://crm.mugnee.com

## Admin Login

- User: admin@crm.com
- Password: Crm@admin1234

The admin account is auto-created or activated on first successful admin login.

## User Creation Flow

- Admin can create Supervisor and Marketer users from `Admin > Users`.
- Supervisor can create Marketer users from `Supervisor > Team`.
- Team users log in with their email address and receive an OTP by email.

## Required Server Environment

Set these values on the production server:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DB_NAME?schema=public"
AUTH_EMAIL_REDIRECT_TO="https://crm.mugnee.com"
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="no-reply@worklog.mugnee.com"
CRM_SHOW_LOGIN_OTP="false"
CRM_ADMIN_EMAIL="admin@crm.com"
CRM_ADMIN_PASSWORD="Crm@admin1234"
```

## Production Start

Run after uploading the latest code:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run build
npm run start
```

## Notes

- Do not commit `.env` or database backup files.
- If email sending fails, set `CRM_SHOW_LOGIN_OTP="true"` temporarily to display OTP on the login screen.

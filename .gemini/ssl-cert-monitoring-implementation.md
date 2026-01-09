# SSL Certificate Notification Scheduler Implementation

## Overview

Implemented a smart notification system for SSL certificate expiration that prevents spam and sends notifications at strategic intervals.

## Database Schema

### Table: `ssl_certificate_notification`

Tracks the last notification sent for each monitor's SSL certificate.

**Columns:**

- `id` (text, PK): Unique identifier
- `monitor_id` (text, FK): Reference to monitor
- `domain` (text): Domain name of the certificate
- `last_notified_at` (timestamp): When the last notification was sent
- `days_until_expiry_at_notification` (text): Days remaining when last notified
- `created_at` (timestamp): Record creation time
- `updated_at` (timestamp): Last update time

**Indexes:**

- `monitor_id` for fast lookups
- `domain` for domain-specific queries

## Notification Logic

### Scheduling Rules

1. **Above Threshold**: No notifications if `daysUntilExpiry > threshold`

2. **First Notification**: Always send when no previous notification exists

3. **Within 7 Days**:
   - Send notification **every day**
   - Example: Days 7, 6, 5, 4, 3, 2, 1

4. **More than 7 Days**:
   - Send notification **every 7 days**
   - Example with 30-day threshold: Days 30, 23, 16, 9, 2

5. **Expired or Invalid**:
   - Always notify immediately
   - Includes certificates with errors

### Example Notification Schedule

For a monitor with `sslCertExpiryNotificationDays = 30`:

```
Day 30: ✅ First notification (threshold reached)
Day 29-24: ⏭️ Skip (within 7-day window)
Day 23: ✅ Notification (7 days passed)
Day 22-17: ⏭️ Skip
Day 16: ✅ Notification (7 days passed)
Day 15-10: ⏭️ Skip
Day 9: ✅ Notification (7 days passed)
Day 8: ⏭️ Skip (entering daily notification zone)
Day 7: ✅ Notification (daily notifications start)
Day 6: ✅ Notification
Day 5: ✅ Notification
Day 4: ✅ Notification
Day 3: ✅ Notification
Day 2: ✅ Notification
Day 1: ✅ Notification
Day 0: ✅ EXPIRED - Immediate notification
```

## API Endpoint

### POST `/api/worker/cert/{monitorId}`

**Request Body:**

```json
{
  "domain": "example.com",
  "issuer": "Let's Encrypt",
  "validFrom": "2024-01-01T00:00:00Z",
  "validTo": "2024-04-01T00:00:00Z",
  "daysUntilExpiry": 23,
  "isValid": true,
  "error": null
}
```

**Response:**

```json
{
  "success": true,
  "notified": true,
  "threshold": 30,
  "daysUntilExpiry": 23,
  "nextNotificationIn": 7
}
```

**Response Fields:**

- `success`: Operation completed successfully
- `notified`: Whether a notification was sent
- `threshold`: Configured notification threshold
- `daysUntilExpiry`: Current days until expiration
- `nextNotificationIn`: Days until next notification (7 or 1)

## Implementation Details

### shouldSendNotification Function

```typescript
function shouldSendNotification(
    daysUntilExpiry: number,
    lastNotification: { 
        lastNotifiedAt: Date; 
        daysUntilExpiryAtNotification: string 
    } | null,
    threshold: number,
): boolean
```

**Logic:**

1. Check if certificate is expired (`daysUntilExpiry < 0`) → Always notify
2. Check if above threshold → Don't notify
3. Check if first notification → Notify
4. Calculate days since last notification
5. Apply 7-day or daily rule based on `daysUntilExpiry`

### Database Operations

**Upsert Pattern:**

- If notification record exists → UPDATE with new timestamp and days
- If no record exists → INSERT new record

This ensures we always have the latest notification state without duplicates.

## Worker Integration

Workers should:

1. Check SSL certificates during HTTP(S) monitor checks
2. Extract certificate information
3. POST to `/api/worker/cert/{monitorId}` with certificate data
4. API handles all notification logic and scheduling

## Event Emission

When a notification is sent, the API emits:

```typescript
eventBus.emit("monitor.ssl.expiring", {
    monitorId: string,
    organizationId: string,
    monitorName: string,
    domain: string,
    issuer: string,
    validFrom: string,
    validTo: string,
    daysUntilExpiry: number,
    isValid: boolean,
    error?: string,
    threshold: number,
});
```

This event can be consumed by:

- Discord webhooks
- Email notifications
- Slack integrations
- Custom notification handlers

## Benefits

✅ **No Spam**: Intelligent scheduling prevents notification fatigue
✅ **Strategic Timing**: More frequent alerts as expiration approaches
✅ **Flexible**: Configurable threshold per monitor
✅ **Reliable**: Database-backed state tracking
✅ **Scalable**: Handles multiple domains per monitor
✅ **Informative**: Tells workers when next notification will be sent

## Migration Required

Run database migration to create the `ssl_certificate_notification` table:

```bash
npm run db:push
# or
npm run db:migrate
```

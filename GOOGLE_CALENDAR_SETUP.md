# Google Calendar Setup

## 1. Create private resource calendars

In the Google account Xerom will use operationally, create these calendars exactly once:

- XEROM — Regular Sim 01
- XEROM — Regular Sim 02
- XEROM — Regular Sim 03
- XEROM — Pro Sim 01
- XEROM — PS5 Lounge 01
- XEROM — PS5 Lounge 02
- XEROM — Booking Control

Set the timezone of every calendar to `Asia/Kuala_Lumpur`. Keep all calendars private.

## 2. Create the Google Cloud integration

1. Create or select a Google Cloud project dedicated to Xerom booking.
2. Enable the Google Calendar API.
3. Create a dedicated service account such as `xerom-booking`.
4. Create one service-account key for the Cloudflare deployment.
5. Store the downloaded key securely; never add it to this repository.

Domain-wide delegation is not required for this architecture. The service account accesses only calendars explicitly shared with its service-account email.

## 3. Share calendars with the service account

For each resource and control calendar:

1. Open Settings and sharing.
2. Add the service-account email under “Share with specific people or groups.”
3. Grant permission to make changes to events.
4. Do not grant permission to manage sharing.

The integration needs to read Busy periods, create bookings, and delete partially created events during rollback.

## 4. Collect calendar IDs

Each calendar’s Settings page shows its Calendar ID under “Integrate calendar.” Map them to these secret names:

```text
REGULAR_SIM_01_CALENDAR_ID
REGULAR_SIM_02_CALENDAR_ID
REGULAR_SIM_03_CALENDAR_ID
PRO_SIM_01_CALENDAR_ID
PS5_01_CALENDAR_ID
PS5_02_CALENDAR_ID
BOOKING_CONTROL_CALENDAR_ID
```

Do not paste real IDs into source files or documentation commits.

## 5. Configure credentials

The service-account key supplies:

```text
GOOGLE_SERVICE_ACCOUNT_EMAIL
GOOGLE_PRIVATE_KEY
```

Set both as encrypted secrets on the booking-coordinator Worker. The private key must retain its line breaks; Cloudflare may store it using escaped `\n` sequences, which the implementation normalizes.

## 6. Verify safely

Use test calendars first. Confirm that:

- FreeBusy returns Busy intervals without event descriptions.
- A website test booking creates events on every assigned resource.
- Manually created Busy events remove the slot from website availability.
- A Booking Control event closes all resources.
- Failed multi-resource creation removes events already created.
- Searching the booking ID finds every event in the group.

Only switch `BOOKING_MODE` to `live` after these checks and Turnstile verification pass.


# Complete Application Workflow  
## Smart Demand-Response & Load-Shifting System

The application is built around one simple idea:

> **The user tells the app what needs to be done and by when. The app suggests a better time to use electricity, explains the benefit and rewards the user after the action is verified.**

The renewable forecasting capability works in the background. It helps the application identify suitable periods for shifting electricity use.

The product has two sides:

1. **Consumer side:** Households, EV owners, businesses and industrial users.
2. **Programme operator side:** Utilities, campuses, commercial sites or authorised energy managers.

---

# 1. Installing and Opening the Application

The application can eventually be provided as a mobile app and web application. For the hackathon prototype, it will be a mobile-first browser/PWA experience: users open a link, choose a demo profile and can optionally install it from the browser. No app-store installation or invasive device permissions are required.

## Welcome screen

The first screen should immediately communicate the value:

> **Use electricity at a better time. Earn rewards for helping renewable energy.**

The screen briefly explains:

- Renewable electricity is not available equally at all times.
- Some activities can be shifted without affecting the user.
- The application suggests suitable time windows.
- Participation is voluntary.
- Rewards are released only after successful verification.

Buttons:

- **Get Started**
- **Try Demo**
- **Learn How It Works**

The **Try Demo** button should take judges directly into a prepared user account.

---

# 2. Select Account Type

The user selects the way they will use the application.

## Options

### Household or individual

For people managing home activities such as water heating or appliance use.

### EV owner

For users who want to schedule charging according to their availability and departure time.

### Business or industry

For managers who control multiple loads or flexible production activities.

### Campus or building operator

For someone coordinating activities across a campus, office, apartment or commercial building.

### Programme operator

For a utility or authorised energy manager who wants to create and monitor demand-response events.

The prototype can provide separate demo accounts for:

- Consumer
- Business
- Programme operator

Household, EV, business and campus users are consumer accounts with a user type and optional site. Only a utility or authorised programme manager uses the operator role.

---

# 3. Consumer Onboarding

The onboarding process should be short. The app should not ask for information that is not required for making a schedule.

## Basic questions

The user is asked:

- What should we call you?
- Which city or area are you located in?
- Are you a household user, EV owner, business or campus?
- Which language would you prefer?
- How would you like to receive reminders?
- Would you like to participate in reward-based events?

The user can choose:

- App notifications
- SMS or email notifications
- Important reminders only
- No non-essential notifications

## Location

The app needs only an approximate location or selected service area.

It does not need precise GPS tracking. Location helps the application use the appropriate weather conditions and programme area.

## Programme connection

If the user belongs to a real programme, the app may ask them to select:

- Electricity supplier or programme name
- Campus or workplace
- Participating building or site

For the prototype, the user sees:

> **Demo programme — sample energy data and illustrative rewards.**

No real electricity account, bank account or identity document is required for the demonstration.

---

# 4. Set Up Activities

After onboarding, the application asks:

> **Which electricity activities would you like to manage?**

The user can select:

- EV charging
- Water heating
- Washing machine or appliance use
- Battery charging
- Commercial equipment
- Industrial process
- Cooling or pre-cooling
- Other approved flexible activity

For the MVP, the working presets are **EV charging, water heating and one approved industrial process**. The remaining cards are future extensions using the same activity rules.

The user can add one or more activities.

The application should explain:

> **Only activities that can safely move in time should be added. Essential activities that must run immediately should remain outside the programme.**

---

# 5. Adding an EV

The user selects **EV Charging**.

The app asks simple questions.

## EV setup questions

- What would you like to call this vehicle?
- When is it usually connected to a charger?
- When must it be ready?
- How much charging is normally required?
- Can charging pause and resume?
- Is the vehicle available every day or only on selected days?
- Should the app only send reminders, or may it schedule a connected charger?
- Are there any days when the vehicle must be charged immediately?

Example answers:

```text
Vehicle name: My scooter
Connected: 10:00 AM
Ready by: 5:00 PM
Charging required: About 2 hours
Availability: Weekdays
Mode: Remind me
```

The user does not need to understand kilowatts or grid terminology. They can provide approximate duration or select a predefined charging requirement.

The application converts that information into a scheduling requirement.

---

# 6. Adding a Water Heater

The user selects **Water Heating**.

## Water-heating questions

- When do you need hot water?
- How long does heating usually take?
- During which hours can heating take place?
- Is the heater a storage heater or instant heater?
- Is this requirement repeated every day?
- Is there any period when heating must not occur?

Example:

```text
Hot water needed by: 7:00 PM
Heating time: 45 minutes
Allowed period: 4:00 PM–7:00 PM
Type: Storage water heater
Routine: Every evening
```

The app should not schedule heating too early if the water may cool before use. For real rewards, verification also needs an appropriate runtime and service signal (such as temperature or storage confirmation where required); energy consumption alone cannot prove that hot water was available.

---

# 7. Adding an Industrial or Business Activity

The business user selects **Add Flexible Activity**.

## Questions

- What is the activity called?
- What is the earliest time it can begin?
- When must it be finished?
- How long does it take?
- Can it be paused?
- Can it be moved without affecting production?
- Does another process need to finish first?
- What is the activity's priority?
- Who approves a schedule change?
- What equipment or meter can confirm completion?

Example:

```text
Activity: Afternoon packaging batch
Earliest start: 12:00 PM
Must finish by: 6:00 PM
Duration: 2 hours
Interruptible: No
Approval required: Shift supervisor
```

The application should not move an industrial activity merely because it consumes a large amount of electricity. The manager must identify activities that are genuinely flexible. For real rewards, verification also needs an approved process-completion signal in addition to the energy record.

---

# 8. Activity List

After activities are added, the user sees **My Activities**.

| Activity | Requirement | Deadline | Status |
|---|---|---|---|
| My scooter | About 2 hours charging | 5:00 PM | Offer available |
| Water heater | 45 minutes heating | 7:00 PM | Scheduled |
| Packaging batch | 2-hour process | 6:00 PM | Awaiting approval |

Selecting an activity opens its details.

The user can:

- Edit the requirement.
- Change the deadline.
- Pause participation.
- Remove the activity.
- Change notification settings.
- View previous schedules.
- View rewards earned from that activity.

When the user changes a deadline, the application checks the activity again and generates a new recommendation.

---

# 9. Home Screen

The home screen should feel like a simple personal assistant, not a technical control room. The recommendation shown here always belongs to an active demand-response event. In the prototype, it comes from the seeded demo event; the app never creates an unexplained standalone offer.

## Main sections

### Today's recommendation

Example:

> **A renewable-rich period is expected this afternoon. Your EV may be suitable for shifting.**

Button: **View Offer**

### Upcoming activities

```text
My scooter
Recommended window: 1:00 PM–3:00 PM
Ready by: 5:00 PM
Status: Offer available
```

### Reward summary

Show separate values:

```text
Verified cashback: ₹24
Pending rewards: ₹12
Reward points: 240
```

Cash amounts and points should not be merged into one balance.

### Renewable timing message

Example:

> **More renewable electricity is expected between 1 PM and 3 PM in your programme area.**

The user can tap **Why this time?** to see a simple explanation.

---

# 10. How the Application Creates an Offer

The application considers:

- Expected renewable availability.
- Normal electricity demand.
- The user's operating window.
- Required energy or duration.
- The user's deadline.
- Equipment power limits.
- Existing accepted activities.
- Reward budget.
- Whether shifting would create another demand peak.

If a suitable window exists, the user receives an offer.

## Example offer

> **Your EV can charge between 1 PM and 3 PM and still be ready before 5 PM. Accept this window and earn a proposed reward after verification.**

The offer displays:

- Activity name.
- Original expected time.
- Recommended time.
- Completion deadline.
- Estimated reward.
- Reason for the recommendation.
- Whether the app will send a reminder or use a connected device.
- Offer expiry time.

Buttons:

- **Accept**
- **Change Time**
- **Skip**
- **View Details**

The application must not create a reward when the activity was already going to happen in the recommended period. Rewards are for verified eligible changes.

---

# 11. Viewing Offer Details

When the user selects **View Details**, the app shows a simple comparison.

```text
Your activity: EV charging

Normal plan:       10:00 AM–12:00 PM
Suggested plan:     1:00 PM–3:00 PM
Ready by:           5:00 PM
Expected benefit:   Better renewable alignment
Proposed reward:    ₹12 after verification
```

The app explains:

> The suggested window has higher expected renewable availability. Your charging requirement and departure deadline remain protected.

It should also state:

> This does not mean your vehicle receives electricity exclusively from renewable sources. It means the programme expects a better renewable supply condition during this period.

---

# 12. Accepting an Offer

When the user taps **Accept**, the app displays a confirmation:

> **Your charging plan has been saved.**  
> Scheduled window: 1:00 PM–3:00 PM  
> Vehicle ready by: 5:00 PM  
> Reward status: Pending verification

The activity status changes to **Accepted**.

The app sends the expected demand shift to the programme operator.

The user can still cancel or change the activity later, subject to the programme rules.

---

# 13. Modifying an Offer

When the user taps **Change Time**, the app displays other feasible windows.

For example:

```text
1:00 PM–3:00 PM     Higher renewable availability     ₹12
2:00 PM–4:00 PM     Moderate renewable availability   ₹8
4:00 PM–5:00 PM     Deadline risk                      Not eligible
```

The application checks that the selected time:

- Meets the completion deadline.
- Fits the equipment's operating limits.
- Does not create an excessive local peak.
- Remains eligible for the displayed reward.

If no suitable option exists, show:

> **No safe reward window is available today. You can continue with your normal schedule.**

The user is not punished for choosing convenience.

---

# 14. Notifications

Notifications should be useful and limited.

Possible notifications:

### New offer

> **You have a new renewable-aligned charging offer.**

### Upcoming activity

> **Your accepted charging window begins in 15 minutes.**

### Activity status

> **Charging has started according to your connected device.**

### Deadline reminder

> **Your activity still needs to be completed before 5 PM.**

### Verification result

> **Your demand shift has been verified.**

### Reward update

> **₹12 has moved from Pending to Verified.**

Users can control:

- Notification frequency.
- Quiet hours.
- Notification channel.
- Which activities should receive reminders.

---

# 15. What Happens During the Activity?

## Manual reminder mode

The app reminds the user when the activity should begin.

Example:

> **Your recommended EV charging window starts now. Start charging when convenient.**

The user can select:

- **Started**
- **Delay**
- **Skip**
- **Change Plan**

The **Started** button is useful for the user's own tracking, but it does not prove electricity was consumed. Verification requires an appropriate meter or device record.

## Connected-device mode

If a charger or equipment system is connected and authorised, the application can display:

> **Charging started at 1:04 PM.**

In a future approved deployment, the application may schedule the device automatically within the user's configured limits.

## Activity status

The user sees:

- Scheduled
- Window started
- In progress
- Completed
- Waiting for verification
- Verified
- Not verified
- Needs review

---

# 16. Verification Flow

After the activity window ends, the application checks the recorded activity against the accepted offer.

## Example successful result

```text
Accepted window: 1:00 PM–3:00 PM
Actual activity: 1:20 PM–2:50 PM
Required energy: 8 kWh
Recorded energy: 7.8 kWh
Deadline: Met
Result: Verified
```

The app displays:

> **Your activity was verified. Your reward is now available according to the programme rules.**

## If only part of the activity was completed

> **Part of your accepted activity was verified. Your reward has been adjusted according to the offer conditions.**

## If the activity was outside the window

> **This activity was not verified because it occurred outside the accepted time window. No reward was issued for this event.**

The user is shown the reason and can request a review.

## If readings are unavailable

> **Verification is pending because activity data has not been received.**

Buttons:

- **Check connection**
- **Request review**

A missing data reading should not automatically be treated as user misconduct.

## Prototype verification

For the hackathon, the application will use simulated readings. The demonstration can replay:

- Successful completion.
- Partial completion.
- Late completion.
- Skipped activity.
- Insufficient energy.
- Missing reading.

The interface should clearly label these as simulated.

---

# 17. Rewards Wallet

The wallet makes the benefit visible.

## Reward categories

### Pending

The user accepted an offer, but the activity has not been checked.

### Verified

The activity met the programme conditions.

### Redeemable

The reward is available under the approved programme rules.

### Points

Non-cash participation points used for badges and challenges.

Example:

```text
Verified cashback: ₹24
Pending cashback: ₹12
Reward points: 240
Next badge: 60 points remaining
```

## Reward history

Each entry shows:

- Activity.
- Date.
- Accepted window.
- Verified result.
- Eligible shifted energy.
- Reward amount.
- Status.
- Explanation.

Cashback, bill credits, vouchers and points should be displayed separately.

The prototype can use a **Demo Wallet**. It should not imply that real money is being transferred.

---

# 18. Gamification

Gamification should encourage repeated participation without making the user feel pressured.

## Points

Users earn points for verified activities.

Examples:

- Completing an eligible EV shift.
- Following an accepted water-heating schedule.
- Participating in a peak-demand event.
- Completing a monthly goal.

## Badges

Examples:

- First Verified Shift
- Solar Aligned
- Renewable Helper
- Reliable Participant
- Flexible Week

## Personal challenges

Examples:

- Complete three eligible shifts this month.
- Follow two recommended charging windows this week.
- Participate in one surplus event and one peak-support event.

## Community goals

A workplace, campus or apartment community could see:

> **Participants have collectively verified 120 kWh of shifted activity this month.**

The application should say **energy shifted**, not automatically **energy saved**.

## Optional rankings

Leaderboards should be optional. If included, they should compare participation fairly instead of rewarding only users with larger appliances or higher electricity consumption.

A user can hide their identity or opt out of rankings.

---

# 19. History and Personal Impact

The **History** screen shows previous activities.

Each record includes:

- Activity completed.
- Time shifted.
- Verification result.
- Reward earned.
- Points earned.
- Reason for success or failure.

Example:

> **This month you completed 4 verified shifts and moved 18 kWh into recommended time windows.**

The app can also show:

- Number of successful activities.
- Participation rate.
- Total verified rewards.
- Missed or skipped offers.
- Community contribution.

Impact statements should remain honest. The app should not claim that an individual consumed only renewable electricity or that every shifted unit directly reduced emissions.

---

# 20. Renewable Surplus Mode

This mode is used when renewable supply is expected to be high compared with demand.

The consumer may receive:

> **More renewable electricity is expected between 1 PM and 3 PM. Your EV and water heater may be suitable for shifting.**

The system may recommend:

- EV charging.
- Water heating.
- Battery charging.
- Approved industrial processes.
- Other flexible consumption.

The supplier view may show:

```text
Expected renewable surplus: 150 kW
Flexible consumer demand available: 90 kW
Battery charging opportunity: 40 kW
Remaining surplus risk: 20 kW
```

The purpose is to absorb more renewable electricity and reduce the risk that available generation cannot be used.

---

# 21. Renewable Shortage or Peak-Support Mode

This mode is used when renewable availability is expected to be low or demand is expected to be high.

A consumer may receive:

> **A high-demand period is expected between 6 PM and 7 PM. Your water heater can run earlier and still provide hot water by 7 PM. View the available reward.**

The application may recommend:

- Delaying flexible activities.
- Moving charging away from the peak.
- Reducing non-essential demand.
- Discharging an available battery.
- Reviewing backup requirements.

The user still has the same choices:

- Accept.
- Modify.
- Skip.

The application should not alarm users with a "grid emergency" message unless the programme operator has formally declared an event.

---

# 22. Business and Industrial User Flow

A business user has a site-level dashboard.

Main navigation:

**Overview · Equipment · Activities · Offers · Verification · Rewards**

## Site setup

The manager provides:

- Site name.
- Operating area.
- Participating equipment.
- Working hours.
- Flexible activities.
- Activity deadlines.
- Interruption rules.
- Approval responsibility.
- Meter or equipment record source.

## Daily workflow

1. Open the site overview.
2. Review renewable-rich or peak-support opportunities.
3. See which activities can move.
4. Review the proposed schedule.
5. Approve or reject the recommendation.
6. Share the schedule with the responsible operator.
7. Monitor activity completion.
8. Review verification and rewards.

The application should show the production effect clearly:

```text
Proposed process start: 2:00 PM
Expected finish: 4:00 PM
Required deadline: 6:00 PM
Production conflict: None
Status: Ready for approval
```

If another process must finish first, the application should flag the dependency before the schedule is accepted.

---

# 23. Programme Operator Flow

The programme operator could be a utility, campus energy manager, commercial-site operator or authorised aggregator.

Main navigation:

**Overview · Events · Flexibility · Verification · Rewards · Reports · Simulation · Settings**

## Operator overview

The screen shows:

- Renewable availability.
- Expected demand.
- Surplus and shortage periods.
- Flexible activities available.
- Accepted commitments.
- Verified response.
- Reward budget remaining.
- Storage or backup recommendations.

The operator should see decisions rather than only charts.

Example:

> **Expected renewable-rich period: 1 PM–3 PM**  
> Recommended action: Send offers to EV and water-heater participants  
> Expected flexible demand: 90 kW  
> Battery recommendation: Charge 40 kW if available

## Creating an event

The operator selects **Create Event** and enters:

- Event objective.
- Target date and time.
- Participating site or user group.
- Eligible activity types.
- Requested flexibility.
- Reward rate.
- Maximum event budget.
- Offer expiry time.
- Minimum and maximum participation.
- Whether the event is surplus absorption or peak support.

Before sending the event, the app previews:

- Number of eligible participants.
- Potential shifted energy.
- Expected reward cost.
- Activities that may not meet deadlines.
- Available flexibility compared with the requested amount.

## Monitoring the event

The operator sees:

```text
Offers sent: 50
Accepted: 31
Expected response: 72 kW
Verified response: 64 kW
Pending readings: 4
Rewards approved: ₹X
```

The application must distinguish:

- **Recommended:** The system found a possible action.
- **Accepted:** A user agreed.
- **Verified:** Activity data confirmed delivery.

## Recommended grid actions

The operator may receive a prioritised action list.

During surplus:

1. Shift flexible demand.
2. Charge storage.
3. Use additional approved flexible loads.
4. Export where possible.
5. Review curtailment only if necessary.

During shortage:

1. Delay flexible demand.
2. Reduce non-essential loads.
3. Discharge storage.
4. Review approved backup.
5. Escalate to the responsible operator.

The application provides recommendations. It does not automatically issue real curtailment or backup commands.

---

# 24. Reports and Results

After an event, the operator can view:

- Requested flexible capacity.
- Accepted capacity.
- Verified capacity.
- Energy shifted.
- Peak demand change.
- Renewable-aligned consumption.
- Number of participating users.
- Reward cost.
- Failed or disputed activities.
- User acceptance rate.

The report should avoid claiming benefits that cannot be proved. For example:

- Shifted energy is not automatically energy saved.
- A forecast is not a guarantee.
- A renewable-rich period does not mean exclusive renewable supply to one user.
- Simulated results are not real utility results.

---

# 25. Important App Rules

The application should always follow these principles:

- Participation is voluntary.
- Users control their own activities.
- Essential tasks are protected.
- Rewards require verification.
- Accepted and verified activities are shown separately.
- Reward conditions are visible before acceptance.
- Users can change plans.
- There is no penalty for skipping a recommendation.
- Personal data is collected only when needed.
- Manual confirmation does not replace meter or device verification for real payments.
- Recommendations update when supply or user conditions change.

---

# 26. Hackathon Prototype Scope

For the first working version, the **must-have** screens are:

1. Demo entry screen.
2. Consumer home screen.
3. Add activity form.
4. Offer details screen.
5. Accept, change and skip flow.
6. Activity status screen.
7. Verification result screen.
8. Rewards wallet.
9. Supplier overview.
10. Surplus action panel.

Use three sample activities:

- One EV.
- One water heater.
- One industrial process.

Use simulated:

- Renewable availability.
- Electricity demand.
- User responses.
- Meter readings.
- Rewards.

After this primary Absorb journey works, add the **stretch** features: Protect mode, battery recommendation, opt-out recovery, what-if controls, event reports, weather-provider integration and optional gamification views. These features must not delay the core forecast → offer → accept → verify → reward flow.

The first complete demonstration should be:

> Renewable-rich period appears → user receives offer → user accepts → schedule changes → simulated activity is completed → result is verified → reward appears → supplier sees the verified response.

This is the central user journey the entire application should make clear.

---

# 27. Workflow-to-Implementation Contract

The implementation follows this exact user journey and does not introduce a separate forecasting product:

```text
Forecast renewable availability
→ classify Absorb or Protect opportunity
→ find eligible flexible activities
→ create a personalised offer
→ user accepts, changes, skips or overrides
→ save the agreed schedule and send a reminder
→ receive simulated/device reading
→ verify against the accepted window, baseline and deadline
→ update reward ledger and impact history
```

### Consumer screens

```text
/login
/consumer/today
/consumer/activities
/consumer/activities/[id]
/consumer/offers
/consumer/rewards
/consumer/profile
```

The consumer navigation is **Today, Activities, Offers, Rewards and Profile**. “Accepted” means the user agreed to an offer; “Verified” means a suitable reading confirmed delivery. These statuses must never be merged.

### Operator screens

```text
/operator/overview
/operator/events
/operator/flexibility
/operator/verification
/operator/rewards
/operator/reports
/operator/simulation
/operator/settings
```

The operator can create an **Absorb** event for renewable surplus or a **Protect** event for a forecast shortage/peak. The application recommends storage, backup review or curtailment review; it does not send real grid-control commands in the prototype.

### Truthful product labels

The interface labels every value as one of:

- **Simulated:** generated for the repeatable hackathon scenario.
- **Weather estimate:** calculated from public weather information.
- **Device reading:** supplied by an authorised meter or device integration.
- **Illustrative reward:** a proposed programme value, not a guaranteed payment.

The prototype uses simulated generation, demand, device readings and rewards. The same interfaces are designed so that public weather providers, approved meters, EV chargers, submeters and programme settlement services can be connected later without changing the consumer workflow.

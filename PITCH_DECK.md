# Pitch Deck: USRide & UCRide
## Smart Energy Campus Transit & Digital Energy Solutions

This document serves as the strategic layout and slide-by-slide structure for the pitch presentation. It aligns the project directly with the **Geothermal Hackathon Challenge (Smart Energy Monitoring & Digital Energy Solutions)** and demonstrates why our solution is vastly superior to the existing UNIBEN RevCollect system.

---

## 1. The Hackathon Alignment (The "Why")
Our project fits the **Smart Energy Monitoring & Digital Energy Solutions** theme by combining real-time electric vehicle (EV) telematics with smart ride-sharing algorithms:

*   **Solar EV Battery Telematics:** Tracks the real-time battery charge percent (`current_battery_percent`) and operating battery life (`estimated_hours_remaining`) of the campus solar-powered Kekes.
*   **Green Dispatching:** Optimizes shared rides (`ride_type: 'shared'`) to reduce energy waste. Grouping students heading to the same destination minimizes the vehicle-kilometers traveled per charge.
*   **Decarbonization & Grid Optimization:** Encourages off-peak charging schedules based on solar availability, reducing the peak grid load of the campus.

---

## 2. Head-to-Head Comparison: Why Ours is Better

| Feature | Existing UNIBEN MVP (`revcollect.com`) | Our Smart Energy Solution (`USRide / UCRide`) |
| :--- | :--- | :--- |
| **Primary Goal** | **Revenue Collection.** Track daily levies, tax collection, and static driver profiles. | **Energy Optimization & Smart Transit.** Booking, routing, and battery tracking. |
| **Rider Experience** | **No Booking.** Students must wait on the road and flag down tricycles manually. | **Cashless On-Demand Booking.** Direct booking, live ETAs, and real-time navigation. |
| **Energy Tracking** | **None.** No awareness of the vehicle's battery level, speed, or consumption. | **Real-time Battery Telematics.** Live tracking of battery drain percent per trip. |
| **Payment Flow** | Offline manual banking or static invoicing. | **Seamless Cashless Ecosystem.** Instant Paystack top-up (card/USSD) and secure payouts. |
| **Geofencing** | No location constraints. | **Automatic Geofenced Tracking** within UNIBEN campus landmarks. |

---

## 3. Slide-by-Slide Pitch Presentation Structure

### 🎬 Slide 1: Title Slide
*   **Title:** USRide & UCRide: The Digital Energy Backbone of Campus Transit
*   **Subtitle:** Real-time EV Energy Monitoring & Cashless Mobility for Smart Universities
*   **Visual:** Screenshot of the Rider app map showing solar Kekes on the UNIBEN campus.

---

### 🚨 Slide 2: The Problem
*   **The Status Quo:** The University of Benin is adopting clean energy (solar Kekes), but lacks a digital brain to run them.
*   **Key Pain Points:**
    *   **Energy Blindness:** Fleet managers and drivers have no way to monitor battery health and charge levels remotely, leading to stranded vehicles on campus roads.
    *   **Inefficient Operations:** Drivers cruise aimlessly looking for riders, wasting valuable solar battery charge.
    *   **Friction in Payment:** Students carry physical cash, slowing down boarding times and causing disputes over change.

---

### 💡 Slide 3: The Solution
*   **Concept:** A unified digital platform designed specifically for smart, solar-powered campus fleets.
*   **Key Pillars:**
    1.  **Smart Energy Monitoring:** Real-time battery percentages and range predictions streamed directly to the cloud.
    2.  **Cashless Micro-Transactions:** A closed-loop wallet system powered by Paystack for instant deposits and payouts.
    3.  **Eco-Routing:** A shared-ride algorithm that matches students in real-time, reducing battery consumption.

---

### 📊 Slide 4: Under the Hood (Energy & Tech Stack)
*   **Supabase Realtime Database:** Instantly syncs vehicle location, battery health, and ride requests across multiple tabs/devices.
*   **Paystack API Gateway:** Secure deposits on the Rider view and automated, cryptographically verified bank payouts on the Driver side.
*   **Battery Analytics Engine:** Simulates energy drain based on vehicle occupancy, terrain, and trip distance to prompt drivers when it is time to return to the solar charging hub.

---

### 🥊 Slide 5: The Competitive Edge (vs. RevCollect)
*   **The Hook:** *"UNIBEN has a transport page, but it's just a billing registry. We built an operational energy platform."*
*   **Visual Graphic:** A checklist comparing the systems:
    *   [x] Real-time Booking (USRide) vs [ ] QR Lookup (RevCollect)
    *   [x] Live Battery Monitoring (USRide) vs [ ] No Energy Data (RevCollect)
    *   [x] Shared Ride Optimization (USRide) vs [ ] Flagging Down (RevCollect)
    *   [x] Instant Paystack Payouts (USRide) vs [ ] Manual Payments (RevCollect)

---

### 🚀 Slide 6: The Future Vision (Scalability)
*   **Off-Peak Charging Integration:** Syncing charger ports with solar output peaks.
*   **Predictive Maintenance:** Alerting fleet managers when a Keke's battery capacity degrades over time.
*   **Expansion to other Federal Universities:** Replicating the smart campus transit model across Nigeria (UI, OAU, UNILAG).

---

### 🏁 Slide 7: Conclusion & Call to Action
*   **Message:** "Driving Smart, Conserving Energy, Powering UNIBEN."
*   **Call to Action:** Partner with the Student Union and the Physical Planning Unit to run a pilot project with 10 solar Kekes.

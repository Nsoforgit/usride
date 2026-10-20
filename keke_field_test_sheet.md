# UNIBEN Keke Telematics Field Test Sheet

**Purpose:** Track real-world campus trip duration, traffic conditions, passenger weight load, and battery depletion rates to calibrate the USRide dynamic ETA & battery prediction models.

---

## 📋 Field Data Recording Table

> Print or copy this grid into a notebook before heading to the field.

| Trip # | Pickup Location | Drop-off Location | Start Time | End Time | Total Time ($T$) (mins) | Google Maps Dist ($D$) (km) | Pass. Count ($L$) | Start Battery (%) | End Battery (%) | Battery Drop ($\Delta\text{SoC}$) (%) | Traffic / Road Remarks |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1** | Main Gate (Ugbowo) | Faculty of Engineering | : | : | | | | % | % | % | |
| **2** | Main Gate (Ugbowo) | Ekosodin Hostels Gate | : | : | | | | % | % | % | |
| **3** | Hall 2 / SUB | UBTH Gate / Med. School | : | : | | | | % | % | % | |
| **4** | Ekosodin Hostels Gate | John Harris Library | : | : | | | | % | % | % | |
| **5** | Main Gate (Ugbowo) | Senate Building / Admin | : | : | | | | % | % | % | |
| **6** | ETF Building | NDDC Hostel | : | : | | | | % | % | % | |
| **7** | Sports Complex | Small Gate | : | : | | | | % | % | % | |
| **8** | Faculty of Law | Main Gate (Ugbowo) | : | : | | | | % | % | % | |

---

## 💡 Field Guide: How to Measure Each Metric Accurately

### 1. Distance ($D$) in Kilometers
- Use **Google Maps** on your phone.
- Set the exact **Origin** and **Destination** for the trip segment.
- Record the exact road distance shown by Google Maps (e.g., `2.4 km`).

---

### 2. Total Elapsed Time ($T$) in Minutes
- Use your **Stopwatch**.
- Start the stopwatch when the Keke moves away from the pickup point.
- Stop it when the Keke comes to a complete halt at the destination.
- Convert seconds to decimals if needed (e.g., 4 mins 30 secs = `4.5 mins`).

---

### 3. Solving the Dynamic Speed Problem (Without Speedometer / Sensors)
Since Keke tricycles rarely have a precise speedometer or digital loggers, **calculate the Effective Speed ($S$) directly from distance and time**:

$$\text{Effective Speed } (S) = \frac{\text{Distance } (D) \text{ in km}}{\text{Time } (T) \text{ in mins}} \times 60 = \text{km/h}$$

* **Example:**
  - Distance $D = 2.4\text{ km}$
  - Elapsed Time $T = 8\text{ mins}$
  - Speed $S = \left(\frac{2.4}{8}\right) \times 60 = \mathbf{18\text{ km/h}}$

---

### 4. Traffic & Delay Tracking (Remarks Column)
To capture how changing speed affects the ride:
- Count the number of **major stops / traffic bottlenecks** (e.g., stopping at Main Gate security checkpoint, slowing down for speed bumps).
- Note down road condition:
  - `Clear` (Uninterrupted movement, avg ~25-30 km/h)
  - `Moderate` (Occasional slowdowns at intersections/speed bumps, avg ~15-20 km/h)
  - `Heavy` (Stuck behind pedestrians near SUB/Faculty gates, idling, avg ~8-12 km/h)

---

### 5. Passenger Load ($L$)
- Record the number of passengers onboard during that specific run ($1, 2, 3,$ or $4$).

---

### 6. Battery Level ($\text{SoC}$)
- Read the digital display/indicator on the driver's Keke dashboard at the **start** and **end** of the trip.
- Record **Start %** and **End %**.
- Subtract to get $\Delta\text{SoC} = \text{Start \%} - \text{End \%}$.

---

> [!TIP]
> **Quick Formula Reference for Field Notes**
> $$\text{Average Speed } (\text{km/h}) = \frac{\text{Distance (km)}}{\text{Trip Time (mins)}} \times 60$$
> $$\text{Battery Rate per km } (\%/ \text{km}) = \frac{\text{Battery Drop } (\%)}{\text{Distance (km)}}$$

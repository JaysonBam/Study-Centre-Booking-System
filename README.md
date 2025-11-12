# Collaboration Room Booking System

A modern web-based system for managing collaboration room bookings at a university study centre.
Staff can schedule, manage, and monitor bookings in real time, with automatic detection for late arrivals and overstays.
Built with a performant React + TypeScript front end and a Supabase backend, the system ensures fast, reliable, and conflict-free booking management.

---

## 📘 Overview

This system centralizes the management of collaboration study rooms, allowing staff to book, extend, and end sessions on behalf of student groups.
All data is synchronized in real time across multiple workstations to prevent booking clashes and ensure room availability is always accurate.

---

## ✨ Key Features

* **Interactive booking grid:** Rooms (columns) vs. time slots (rows, 30-minute increments).
* **Real-time updates:** All active stations reflect changes instantly.
* **Smart booking states:** Reserved, Active, Late, Overdue, and Ended (auto-detected).
* **Extension limits:** Extend bookings only when time slots are available (max 2 hours).
* **Early end detection:** Free up rooms immediately when groups finish early.
* **Room labels:** Track issues (e.g., lights/plugs not working), open/closed state, and capacity.
* **Borrowed items tracking:** Note HDMI adapters, keyboards, etc.
* **Search:** Quickly find bookings by student number.
* **Analytics:** Usage reports by discipline, time, and day of week.
* **Admin controls:** Manage rooms, staff, disciplines, and operation hours.

---

## 🧭 Roles and Access

| Role      | Permissions                                                                |
| --------- | -------------------------------------------------------------------------- |
| **Admin** | Manage staff, rooms, hours, disciplines, analytics, and bulk bookings.     |
| **Staff** | Create, extend, and end bookings; add room labels; manage active sessions. |

Authentication is managed through Supabase, and all staff accounts are created by an admin (no public signup).

---

## 🧰 Tech Stack

### **Frontend**

| Component          | Technology                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------------------------------- |
| Framework          | **React 18 (TypeScript)**                                                                                  |
| Build tool         | **Vite 5 (with SWC plugin)**                                                                               |
| Styling            | **Tailwind CSS 3.4** + typography + animate                                                                |
| UI toolkit         | **shadcn/ui**, **Radix UI primitives**, **Lucide React** icons                                             |
| State & data       | **React Query**, **React Router**, **React Hook Form**, **Zod** validation                                 |
| Charts & utilities | **Recharts**, **date-fns**, **sonner**, **embla-carousel-react**, **react-day-picker**, **tailwind-merge** |
| Hosting            | **Vercel** (connected to study centre Gmail)                                                               |

### **Backend**

| Component   | Technology                                            |
| ----------- | ----------------------------------------------------- |
| Platform    | **Supabase** (PostgreSQL + Auth + Realtime)           |
| Integration | `@supabase/supabase-js` client                        |
| Features    | Auth, database, and realtime updates for booking grid |

### **Tooling & Dev Environment**

| Tool                   | Purpose                                 |
| ---------------------- | --------------------------------------- |
| Node 18+ / npm         | Development runtime                     |
| ESLint                 | Code linting and consistency            |
| PostCSS + Autoprefixer | Tailwind processing                     |
| Vite Dev Server        | Fast local development                  |
| GitLab CI/CD           | Source control and deployment pipelines |

---

## 🚀 Getting Started

### 1️⃣ Prerequisites

* **Node.js 18+** (recommended)
* **npm** (or **Bun**, optional)
* A configured **Supabase project** (with environment variables)

### 2️⃣ Setup

Clone the repository:

```bash
git clone <your-repo-url>
cd <your-repo-folder>
```

Install dependencies:

```bash
npm install
```

### 3️⃣ Environment

Create a `.env` file in the project root with:

```env
VITE_SUPABASE_URL=https://your-supabase-url.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4️⃣ Run locally

```bash
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### 5️⃣ Build for production

```bash
npm run build
```

Deploy to **Vercel** and connect to your Supabase backend.

---

## 📄 Documentation

* **User Requirements Specification (URS)** — defines system goals and functional requirements.
* **Admin Guide** — managing users, rooms, and system settings.
* **Staff Guide** — daily operation and booking workflows.
* **Developer Docs** — setup, hosting, and environment configuration.

---

## 🧑‍💻 Project Information

| Field            | Detail                                 |
| ---------------- | -------------------------------------- |
| **Author**       | Jayson Bam                             |
| **Prepared for** | Study Centre Admin                     |
| **Version**      | 1.1                                    |
| **Date**         | 12 November 2025                       |
| **Hosting**      | Vercel (Frontend) + Supabase (Backend) |

---

## 🧠 License

This project is developed for academic and internal study centre use.
All source code is open for internal modification, extension, and reuse.

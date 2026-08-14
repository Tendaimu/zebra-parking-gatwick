import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Car, MapPin, Clock, CreditCard, CheckCircle2, Navigation,
  PlaneTakeoff, PlaneLanding, ShieldCheck, ChevronRight, ChevronLeft,
  Loader2, Phone, Mail, User, Calendar, AlertCircle, MessageCircle
} from "lucide-react";

const GATWICK = { lat: 51.1537, lng: -0.1821, label: "Gatwick North Terminal, Zebra forecourt" };
const DAILY_RATE = 6.5;
const BOOKING_FEE = 4;
const WHATSAPP_NUMBER = "441293300006";

function whatsappLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function makeRef() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "ZB-";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

const STAGE_LABELS = {
  dropoff: ["Booked", "Confirmed", "En route", "Handover"],
  pickup: ["Parked", "Requested", "Returning", "Collected"],
};

function FlipText({ text, className = "" }) {
  return (
    <span className={`flip-row ${className}`}>
      {text.split("").map((ch, i) => (
        <span className="flip-cell" key={i} style={{ animationDelay: `${i * 35}ms` }}>
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </span>
  );
}

function Crossing({ stage, mode }) {
  const labels = STAGE_LABELS[mode];
  const bars = 9;
  return (
    <div className="w-full">
      <div className="relative h-14 rounded-md overflow-hidden" style={{ background: "var(--ink)" }}>
        <div className="absolute inset-0 flex items-center justify-between px-2">
          {Array.from({ length: bars }).map((_, i) => (
            <div key={i} style={{ width: "7%", height: "70%", background: "var(--paper)" }} />
          ))}
        </div>
        <div
          className="absolute top-1/2 transition-all duration-700 ease-out"
          style={{
            left: `calc(${(stage / (labels.length - 1)) * 88}% )`,
            transform: "translate(-10%, -50%)",
          }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{ width: 30, height: 30, background: "var(--beacon)" }}
          >
            <Car size={17} color="var(--ink)" />
          </div>
        </div>
      </div>
      <div className="flex justify-between mt-2">
        {labels.map((l, i) => (
          <span
            key={l}
            className="font-mono text-[11px] tracking-wide uppercase"
            style={{
              color: i <= stage ? "var(--beacon-dk)" : "var(--muted)",
              fontWeight: i === stage ? 600 : 400,
            }}
          >
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepHeader({ step }) {
  const steps = ["Search", "Details", "Checkout", "Confirmed"];
  return (
    <div className="flex items-center gap-1 mb-5">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex items-center gap-1.5">
            <div
              className="flex items-center justify-center rounded-full font-mono text-[11px]"
              style={{
                width: 20,
                height: 20,
                background: i <= step ? "var(--beacon)" : "var(--stripe)",
                color: i <= step ? "var(--ink)" : "var(--muted)",
              }}
            >
              {i + 1}
            </div>
            <span
              className="text-[11px] uppercase tracking-wide hidden sm:inline"
              style={{ color: i <= step ? "var(--ink)" : "var(--muted)" }}
            >
              {s}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="flex-1 h-px" style={{ background: "var(--line)" }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  background: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: 6,
  color: "var(--ink)",
  outline: "none",
};

export default function ZebraParkingApp() {
  const [step, setStep] = useState(0);
  const [booking, setBooking] = useState({
    dropDate: todayISO(1),
    dropTime: "07:30",
    returnDate: todayISO(5),
    returnTime: "18:00",
    terminal: "North",
    reg: "",
  });
  const [details, setDetails] = useState({
    name: "",
    email: "",
    phone: "",
    make: "",
    model: "",
    colour: "",
  });
  const [errors, setErrors] = useState({});
  const [card, setCard] = useState({ number: "", exp: "", cvc: "" });
  const [paying, setPaying] = useState(false);
  const [bookingRef, setBookingRef] = useState("");
  const [trackMode, setTrackMode] = useState(null); // 'dropoff' | 'pickup' | null

  const days = useMemo(() => {
    const d1 = new Date(`${booking.dropDate}T${booking.dropTime}`);
    const d2 = new Date(`${booking.returnDate}T${booking.returnTime}`);
    const diff = Math.max(1, Math.ceil((d2 - d1) / 86400000));
    return diff;
  }, [booking]);

  const price = useMemo(() => {
    const parking = days * DAILY_RATE;
    return { parking, fee: BOOKING_FEE, total: parking + BOOKING_FEE };
  }, [days]);

  function validateSearch() {
    const e = {};
    const d1 = new Date(`${booking.dropDate}T${booking.dropTime}`);
    const d2 = new Date(`${booking.returnDate}T${booking.returnTime}`);
    if (!booking.reg.trim()) e.reg = "Enter your vehicle registration.";
    if (d2 <= d1) e.dates = "Collection must be after drop-off.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateDetails() {
    const e = {};
    if (!details.name.trim()) e.name = "Enter your name.";
    if (!/^\S+@\S+\.\S+$/.test(details.email)) e.email = "Enter a valid email.";
    if (!/^[0-9+ ]{7,}$/.test(details.phone)) e.phone = "Enter a valid phone number.";
    if (!details.make.trim()) e.make = "Enter your car make.";
    if (!details.colour.trim()) e.colour = "Enter your car colour.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateCard() {
    const e = {};
    if (!/^[0-9 ]{16,19}$/.test(card.number)) e.number = "Enter a 16 digit card number.";
    if (!/^\d{2}\/\d{2}$/.test(card.exp)) e.exp = "Use MM/YY format.";
    if (!/^\d{3,4}$/.test(card.cvc)) e.cvc = "Enter the 3 digit security code.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function pay() {
    if (!validateCard()) return;
    setPaying(true);
    setTimeout(() => {
      setBookingRef(makeRef());
      setPaying(false);
      setStep(3);
    }, 1100);
  }

  return (
    <div style={{ fontFamily: "var(--font-body)", background: "var(--paper)", minHeight: 400 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;900&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .zb-root {
          --ink: #14151A;
          --paper: #F7F5F0;
          --stripe: #E4E2DA;
          --line: #C9C6BC;
          --muted: #86847B;
          --beacon: #F5A623;
          --beacon-dk: #8A5A0E;
          --runway: #1F7A5C;
          --alert: #D64545;
          --font-display: 'Big Shoulders Display', sans-serif;
          --font-body: 'IBM Plex Sans', sans-serif;
          --font-mono: 'IBM Plex Mono', monospace;
        }
        .zb-stripes {
          background: repeating-linear-gradient(-45deg, var(--ink) 0 14px, var(--beacon) 14px 28px);
        }
        .font-display { font-family: var(--font-display); }
        .font-mono { font-family: var(--font-mono); }
        .flip-row { display: inline-flex; gap: 2px; }
        .flip-cell {
          display: inline-block;
          font-family: var(--font-mono);
          animation: flipIn 260ms ease both;
        }
        @keyframes flipIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .zb-btn-primary {
          background: var(--ink); color: var(--paper); border: none;
          font-family: var(--font-body); font-weight: 600; font-size: 14px;
          padding: 12px 20px; border-radius: 6px; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
        .zb-btn-primary:disabled { opacity: 0.5; cursor: default; }
        .zb-btn-secondary {
          background: transparent; color: var(--ink); border: 1px solid var(--line);
          font-family: var(--font-body); font-weight: 500; font-size: 14px;
          padding: 12px 20px; border-radius: 6px; cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
        .zb-err { color: var(--alert); font-size: 12px; margin-top: -8px; margin-bottom: 10px; }
        .zb-btn-whatsapp {
          background: #25D366; color: #06210F; border: none;
          font-family: var(--font-body); font-weight: 600; font-size: 14px;
          padding: 12px 20px; border-radius: 6px; cursor: pointer; text-decoration: none;
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        }
      `}</style>

      <div className="zb-root max-w-md mx-auto" style={{ color: "var(--ink)" }}>
        {/* Header */}
        <div className="zb-stripes" style={{ height: 6 }} />
        <div className="px-5 pt-4 pb-3 flex items-center justify-between">
          <div>
            <div className="font-display" style={{ fontSize: 22, lineHeight: 1, fontWeight: 900, letterSpacing: 0.5 }}>
              ZEBRA PARKING
            </div>
            <div className="font-mono text-[11px] uppercase tracking-widest" style={{ color: "var(--muted)" }}>
              Gatwick &middot; meet &amp; greet
            </div>
          </div>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded"
            style={{ background: "var(--stripe)" }}
          >
            <ShieldCheck size={14} color="var(--runway)" />
            <span className="font-mono text-[11px]" style={{ color: "var(--runway)" }}>Insured</span>
          </div>
        </div>

        <div className="px-5 pb-8">
          {step < 3 && <StepHeader step={step} />}

          {step === 0 && (
            <SearchScreen
              booking={booking}
              setBooking={setBooking}
              errors={errors}
              days={days}
              price={price}
              onNext={() => validateSearch() && setStep(1)}
            />
          )}

          {step === 1 && (
            <DetailsScreen
              details={details}
              setDetails={setDetails}
              errors={errors}
              onBack={() => setStep(0)}
              onNext={() => validateDetails() && setStep(2)}
            />
          )}

          {step === 2 && (
            <CheckoutScreen
              booking={booking}
              days={days}
              price={price}
              card={card}
              setCard={setCard}
              errors={errors}
              paying={paying}
              onBack={() => setStep(1)}
              onPay={pay}
            />
          )}

          {step === 3 && !trackMode && (
            <ConfirmationScreen
              bookingRef={bookingRef}
              booking={booking}
              details={details}
              price={price}
              onTrack={(m) => setTrackMode(m)}
            />
          )}

          {step === 3 && trackMode && (
            <TrackingScreen
              mode={trackMode}
              booking={booking}
              onBack={() => setTrackMode(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function SearchScreen({ booking, setBooking, errors, days, price, onNext }) {
  const set = (k) => (e) => setBooking({ ...booking, [k]: e.target.value });
  return (
    <div>
      <h2 className="font-display" style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>
        Book your space
      </h2>
      <p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
        Drive to our forecourt, hand us the keys, walk to check-in. We bring the car back for your return.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Drop-off date">
          <input type="date" style={inputStyle} value={booking.dropDate} onChange={set("dropDate")} />
        </Field>
        <Field label="Drop-off time">
          <input type="time" style={inputStyle} value={booking.dropTime} onChange={set("dropTime")} />
        </Field>
        <Field label="Collection date">
          <input type="date" style={inputStyle} value={booking.returnDate} onChange={set("returnDate")} />
        </Field>
        <Field label="Collection time">
          <input type="time" style={inputStyle} value={booking.returnTime} onChange={set("returnTime")} />
        </Field>
      </div>
      {errors.dates && <div className="zb-err">{errors.dates}</div>}

      <Field label="Terminal">
        <select style={inputStyle} value={booking.terminal} onChange={set("terminal")}>
          <option>North</option>
          <option>South</option>
        </select>
      </Field>

      <Field label="Vehicle registration">
        <input
          style={inputStyle}
          placeholder="e.g. LP19 ZBR"
          value={booking.reg}
          onChange={(e) => setBooking({ ...booking, reg: e.target.value.toUpperCase() })}
        />
      </Field>
      {errors.reg && <div className="zb-err">{errors.reg}</div>}

      <div className="mt-4 p-3 rounded-md flex items-center justify-between" style={{ background: "var(--stripe)" }}>
        <div className="font-mono text-[12px]" style={{ color: "var(--muted)" }}>
          {days} {days === 1 ? "day" : "days"} &middot; &pound;{DAILY_RATE.toFixed(2)}/day
        </div>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 900 }}>
          &pound;{price.total.toFixed(2)}
        </div>
      </div>

      <button className="zb-btn-primary w-full mt-4" onClick={onNext}>
        Continue <ChevronRight size={16} />
      </button>
    </div>
  );
}

function DetailsScreen({ details, setDetails, errors, onBack, onNext }) {
  const set = (k) => (e) => setDetails({ ...details, [k]: e.target.value });
  return (
    <div>
      <h2 className="font-display" style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>
        Your details
      </h2>

      <Field label="Full name">
        <input style={inputStyle} value={details.name} onChange={set("name")} placeholder="Alex Morgan" />
      </Field>
      {errors.name && <div className="zb-err">{errors.name}</div>}

      <Field label="Email">
        <input style={inputStyle} value={details.email} onChange={set("email")} placeholder="alex@email.com" />
      </Field>
      {errors.email && <div className="zb-err">{errors.email}</div>}

      <Field label="Mobile number">
        <input style={inputStyle} value={details.phone} onChange={set("phone")} placeholder="07700 900123" />
      </Field>
      {errors.phone && <div className="zb-err">{errors.phone}</div>}
      <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
        <MapPin size={11} style={{ display: "inline", marginRight: 3, verticalAlign: -1 }} />
        Used to share your live location so we time your handover.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Car make">
          <input style={inputStyle} value={details.make} onChange={set("make")} placeholder="Volkswagen" />
        </Field>
        <Field label="Model">
          <input style={inputStyle} value={details.model} onChange={set("model")} placeholder="Golf" />
        </Field>
      </div>
      {errors.make && <div className="zb-err">{errors.make}</div>}

      <Field label="Colour">
        <input style={inputStyle} value={details.colour} onChange={set("colour")} placeholder="Grey" />
      </Field>
      {errors.colour && <div className="zb-err">{errors.colour}</div>}

      <div className="flex gap-2 mt-4">
        <button className="zb-btn-secondary" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <button className="zb-btn-primary flex-1" onClick={onNext}>
          Continue to payment <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

function CheckoutScreen({ booking, days, price, card, setCard, errors, paying, onBack, onPay }) {
  return (
    <div>
      <h2 className="font-display" style={{ fontSize: 24, fontWeight: 900, marginBottom: 12 }}>
        Checkout
      </h2>

      <div className="p-3 rounded-md mb-4" style={{ background: "var(--stripe)" }}>
        <Row label={`Parking (${days} ${days === 1 ? "day" : "days"})`} value={`£${price.parking.toFixed(2)}`} />
        <Row label="Booking fee" value={`£${price.fee.toFixed(2)}`} />
        <div className="h-px my-2" style={{ background: "var(--line)" }} />
        <Row label="Total" value={`£${price.total.toFixed(2)}`} bold />
      </div>

      <Field label="Card number">
        <input
          style={inputStyle}
          placeholder="4242 4242 4242 4242"
          value={card.number}
          onChange={(e) => setCard({ ...card, number: e.target.value })}
        />
      </Field>
      {errors.number && <div className="zb-err">{errors.number}</div>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Expiry">
          <input
            style={inputStyle}
            placeholder="MM/YY"
            value={card.exp}
            onChange={(e) => setCard({ ...card, exp: e.target.value })}
          />
        </Field>
        <Field label="Security code">
          <input
            style={inputStyle}
            placeholder="CVC"
            value={card.cvc}
            onChange={(e) => setCard({ ...card, cvc: e.target.value })}
          />
        </Field>
      </div>
      {(errors.exp || errors.cvc) && <div className="zb-err">{errors.exp || errors.cvc}</div>}

      <div className="flex gap-2 mt-4">
        <button className="zb-btn-secondary" onClick={onBack} disabled={paying}>
          <ChevronLeft size={16} /> Back
        </button>
        <button className="zb-btn-primary flex-1" onClick={onPay} disabled={paying}>
          {paying ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Processing
            </>
          ) : (
            <>
              <CreditCard size={16} /> Pay £{price.total.toFixed(2)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex justify-between text-[13px] mb-1">
      <span style={{ color: bold ? "var(--ink)" : "var(--muted)", fontWeight: bold ? 600 : 400 }}>{label}</span>
      <span className="font-mono" style={{ fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}

function ConfirmationScreen({ bookingRef, booking, details, price, onTrack }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <CheckCircle2 size={20} color="var(--runway)" />
        <span className="font-display" style={{ fontSize: 22, fontWeight: 900 }}>
          Booking confirmed
        </span>
      </div>
      <p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
        A confirmation has been sent to {details.email || "your email"}.
      </p>

      <div className="p-3 rounded-md mb-4" style={{ background: "var(--ink)", color: "var(--paper)" }}>
        <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: "var(--beacon)" }}>
          Booking reference
        </div>
        <FlipText text={bookingRef} className="text-[22px] font-mono" />
      </div>

      <div className="p-3 rounded-md mb-4" style={{ background: "var(--stripe)" }}>
        <Row label="Vehicle" value={`${details.make || "—"} ${details.model || ""}, ${details.colour || "—"}`} />
        <Row label="Registration" value={booking.reg || "—"} />
        <Row label="Drop-off" value={`${booking.dropDate} · ${booking.dropTime}`} />
        <Row label="Collection" value={`${booking.returnDate} · ${booking.returnTime}`} />
        <Row label="Terminal" value={booking.terminal} />
        <Row label="Total paid" value={`£${price.total.toFixed(2)}`} bold />
      </div>

      <p className="text-[11px] uppercase tracking-wide mb-2" style={{ color: "var(--muted)" }}>
        Live handover tracking
      </p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button className="zb-btn-secondary" onClick={() => onTrack("dropoff")}>
          <PlaneTakeoff size={16} /> Track drop-off
        </button>
        <button className="zb-btn-secondary" onClick={() => onTrack("pickup")}>
          <PlaneLanding size={16} /> Track collection
        </button>
      </div>

      <a
        className="zb-btn-whatsapp w-full"
        href={whatsappLink(
          `Hi Zebra Parking, this is regarding booking ${bookingRef}. Reg: ${booking.reg || "—"}, drop-off ${booking.dropDate} ${booking.dropTime}, collection ${booking.returnDate} ${booking.returnTime}.`
        )}
        target="_blank"
        rel="noopener noreferrer"
      >
        <MessageCircle size={16} /> Message us on WhatsApp
      </a>
    </div>
  );
}

function TrackingScreen({ mode, booking, onBack }) {
  const [status, setStatus] = useState("idle"); // idle | locating | tracking | denied | arrived
  const [distanceKm, setDistanceKm] = useState(null);
  const [etaMin, setEtaMin] = useState(null);
  const [progress, setProgress] = useState(0);
  const [notified, setNotified] = useState(false);
  const initialDist = useRef(null);
  const watchId = useRef(null);
  const simTimer = useRef(null);

  const stageIndex = useMemo(() => {
    if (status === "arrived") return 3;
    if (status === "tracking" && progress > 5) return 2;
    if (status === "tracking") return mode === "dropoff" ? 1 : 1;
    return 0;
  }, [status, progress, mode]);

  useEffect(() => {
    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      if (simTimer.current) clearInterval(simTimer.current);
    };
  }, []);

  function handlePosition(pos) {
    const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const d = haversineKm(here, GATWICK);
    if (initialDist.current == null) initialDist.current = Math.max(d, 0.2);
    setDistanceKm(d);
    setEtaMin(Math.max(1, Math.round((d / 45) * 60)));
    const pct = Math.min(100, Math.max(0, ((initialDist.current - d) / initialDist.current) * 100));
    setProgress(pct);
    setStatus("tracking");
    if (d < 0.35 && !notified) {
      setNotified(true);
      setStatus("arrived");
      setProgress(100);
    }
  }

  function startRealTracking() {
    setStatus("locating");
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    watchId.current = navigator.geolocation.watchPosition(
      handlePosition,
      () => setStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  function startSimulation() {
    setStatus("tracking");
    initialDist.current = 18;
    let d = 18;
    simTimer.current = setInterval(() => {
      d = Math.max(0, d - 1.2);
      const pct = ((18 - d) / 18) * 100;
      setDistanceKm(d);
      setEtaMin(Math.max(1, Math.round((d / 45) * 60)));
      setProgress(pct);
      if (d <= 0) {
        clearInterval(simTimer.current);
        setStatus("arrived");
        setProgress(100);
        setNotified(true);
      }
    }, 900);
  }

  const copy =
    mode === "dropoff"
      ? {
          title: "On your way to drop off",
          idleBlurb: "Share your live location and our valet team will be ready for your reg " + (booking.reg || "—") + " as you arrive.",
          arrived: "You've arrived. Head to the Zebra forecourt — a valet is waiting to take your keys.",
          notifyLabel: "Valet team notified of your ETA",
        }
      : {
          title: "On your way to collect",
          idleBlurb: "Share your live location and we'll bring your car up to the forecourt so it's ready when you land.",
          arrived: "You've arrived. Your car is being brought to the forecourt now.",
          notifyLabel: "Return driver notified to bring your car forward",
        };

  return (
    <div>
      <button className="zb-btn-secondary mb-4" onClick={onBack}>
        <ChevronLeft size={16} /> Back
      </button>

      <h2 className="font-display" style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>
        {copy.title}
      </h2>
      <p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
        {status === "arrived" ? copy.arrived : copy.idleBlurb}
      </p>

      <Crossing stage={stageIndex} mode={mode} />

      <div className="mt-4 p-3 rounded-md" style={{ background: "var(--stripe)" }}>
        {status === "idle" && (
          <div className="flex flex-col gap-2">
            <button className="zb-btn-primary" onClick={startRealTracking}>
              <Navigation size={16} /> Share my live location
            </button>
            <button className="zb-btn-secondary" onClick={startSimulation}>
              Preview with a simulated journey
            </button>
          </div>
        )}

        {status === "locating" && (
          <div className="flex items-center gap-2 text-[13px]">
            <Loader2 size={16} className="animate-spin" /> Getting your location…
          </div>
        )}

        {status === "denied" && (
          <div>
            <div className="flex items-center gap-2 text-[13px] mb-2" style={{ color: "var(--alert)" }}>
              <AlertCircle size={16} /> Location wasn't shared.
            </div>
            <p className="text-[12px] mb-2" style={{ color: "var(--muted)" }}>
              Allow location access in your browser, or preview how tracking works instead.
            </p>
            <button className="zb-btn-secondary" onClick={startSimulation}>
              Preview with a simulated journey
            </button>
          </div>
        )}

        {(status === "tracking" || status === "arrived") && (
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>Distance to Gatwick</span>
              <span className="font-mono text-[13px]">{distanceKm != null ? `${distanceKm.toFixed(1)} km` : "—"}</span>
            </div>
            <div className="flex justify-between mb-1">
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>Estimated arrival</span>
              <span className="font-mono text-[13px]">{status === "arrived" ? "Now" : etaMin != null ? `${etaMin} min` : "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>{copy.notifyLabel}</span>
              <CheckCircle2 size={16} color="var(--runway)" />
            </div>
          </div>
        )}
      </div>

      {status === "arrived" && (
        <div className="mt-4 p-3 rounded-md flex items-center gap-2" style={{ background: "var(--ink)", color: "var(--paper)" }}>
          <MapPin size={16} color="var(--beacon)" />
          <span className="text-[13px]">Meet your valet on the {booking.terminal} Terminal forecourt.</span>
        </div>
      )}

      {(status === "tracking" || status === "arrived") && (
        <a
          className="zb-btn-whatsapp w-full mt-3"
          href={whatsappLink(
            status === "arrived"
              ? `Hi Zebra Parking, I've arrived at ${booking.terminal} Terminal. Reg: ${booking.reg || "—"}.`
              : `Hi Zebra Parking, I'm ${distanceKm != null ? distanceKm.toFixed(1) + "km" : "on my way"} out, ETA ${etaMin || "—"} min. Reg: ${booking.reg || "—"}.`
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          <MessageCircle size={16} /> Message us on WhatsApp
        </a>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Bike, Route, TreePine, Cog, Shirt, Wrench, Search, X, Plus,
  Clock, MapPin, ChevronDown, Gavel, Tag, RotateCcw
} from "lucide-react";

/* ---------------------------------------------------------
   SPOKE — a cycling-specific marketplace demo
   Browsing, filtering, in-memory bidding, and listing gear.
   No checkout/payments — this is a working prototype only.
--------------------------------------------------------- */

const CATEGORIES = [
  { key: "road", label: "Xe đường", icon: Bike, grad: "linear-gradient(135deg, var(--route), var(--route-dark))" },
  { key: "gravel", label: "Xe Gravel & CX", icon: Route, grad: "linear-gradient(135deg, var(--steel), var(--asphalt))" },
  { key: "mountain", label: "Xe Leo Núi", icon: TreePine, grad: "linear-gradient(135deg, var(--asphalt), var(--route-dark))" },
  { key: "drivetrain", label: "Bánh & Hộp số", icon: Cog, grad: "linear-gradient(135deg, #9aa3a0, var(--steel))" },
  { key: "apparel", label: "Trang phục", icon: Shirt, grad: "linear-gradient(135deg, var(--flare), #b8401d)" },
  { key: "accessories", label: "Phụ kiện & Công cụ", icon: Wrench, grad: "linear-gradient(135deg, var(--caution), #b98a04)" },
];

const CONDITIONS = [
  { key: "showroom", label: "Như mới", fill: 4 },
  { key: "race-ready", label: "Sẵn sàng đua", fill: 3 },
  { key: "well-ridden", label: "Đã sử dụng tốt", fill: 2 },
  { key: "project", label: "Dự án xe", fill: 1 },
];

const catMeta = (key) => CATEGORIES.find((c) => c.key === key) || CATEGORIES[0];
const condMeta = (key) => CONDITIONS.find((c) => c.key === key) || CONDITIONS[1];

const now0 = Date.now();
const days = (n) => n * 86400000;
const hours = (n) => n * 3600000;

const SEED_LISTINGS = [
  {
    id: "l1", title: "2021 Specialized Tarmac SL7 Expert — 56cm", category: "road",
    type: "fixed", price: 2400, condition: "race-ready", location: "Thành phố Hồ Chí Minh",
    createdAt: now0 - hours(30),
    description: "Bộ Ultegra Di2 hoàn chỉnh, bánh Roval Rapide CLX. Có một vết nhỏ trên ống chính (được chụp ảnh), ngoài ra sẵn sàng cho ngày thi đấu. Kèm lốp 30mm dự phòng.",
  },
];

function formatCurrency(n) {
  return `$${n.toLocaleString("en-US")}`;
}

function formatTimeLeft(endMs, nowMs) {
  const diff = endMs - nowMs;
  if (diff <= 0) return "Đấu giá đã kết thúc";
  const d = Math.floor(diff / days(1));
  const h = Math.floor((diff % days(1)) / hours(1));
  const m = Math.floor((diff % hours(1)) / 60000);
  if (d > 0) return `${d}n ${h}h còn lại`;
  if (h > 0) return `${h}h ${m}m còn lại`;
  return `${m}m còn lại`;
}

function ElevationDivider({ flat = false }) {
  const path =
    "M0,95 L50,80 L100,88 L150,55 L200,70 L250,30 L300,58 L350,38 L400,68 L450,48 L500,78 L550,40 L600,60 L650,18 L700,48 L750,28 L800,62 L850,42 L900,72 L950,52 L1000,82 L1050,60 L1100,90 L1150,70 L1200,95";
  return (
    <svg
      viewBox="0 0 1200 100"
      preserveAspectRatio="none"
      className="elevation-svg"
      style={{ width: "100%", height: flat ? 40 : 90, display: "block" }}
    >
      <path d={path} fill="none" stroke="var(--caution)" strokeWidth="3" className="elevation-path" />
    </svg>
  );
}

function TreadBar({ fill }) {
  return (
    <div className="tread-bar" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={`tread-seg ${i <= fill ? "tread-on" : ""}`} />
      ))}
    </div>
  );
}

function Thumb({ category, size = "normal" }) {
  const meta = catMeta(category);
  const Icon = meta.icon;
  return (
    <div className="thumb" style={{ background: meta.grad }}>
      <div className="thumb-texture" />
      <Icon size={size === "large" ? 64 : 40} color="#F5F4EF" strokeWidth={1.5} style={{ opacity: 0.85 }} />
    </div>
  );
}

function ListingCard({ listing, nowMs, onOpen }) {
  const meta = catMeta(listing.category);
  const cond = condMeta(listing.condition);
  return (
    <button className="card" onClick={() => onOpen(listing)}>
      <Thumb category={listing.category} />
      <div className="card-body">
        <div className="card-eyebrow font-mono">{meta.label}</div>
        <h3 className="card-title font-body">{listing.title}</h3>
        <div className="card-cond">
          <TreadBar fill={cond.fill} />
          <span className="font-mono cond-label">{cond.label}</span>
        </div>
        <div className="card-footer">
          <div className="card-price font-mono">
            {listing.type === "fixed"
              ? formatCurrency(listing.price)
              : formatCurrency(listing.currentBid)}
          </div>
          <div className={`badge ${listing.type === "auction" ? "badge-auction" : "badge-fixed"}`}>
            {listing.type === "auction" ? <Gavel size={12} /> : <Tag size={12} />}
            {listing.type === "auction" ? formatTimeLeft(listing.bidEnd, nowMs) : "Buy Now"}
          </div>
        </div>
        <div className="card-meta font-mono">
          <MapPin size={11} /> {listing.location}
        </div>
      </div>
    </button>
  );
}

function DetailModal({ listing, nowMs, onClose, onBid, onBuyNow }) {
  const [bidValue, setBidValue] = useState("");
  const [bidError, setBidError] = useState("");
  const meta = catMeta(listing.category);
  const cond = condMeta(listing.condition);
  const minBid = listing.type === "auction" ? listing.currentBid + 10 : 0;

  const chartPoints = useMemo(() => {
    if (!listing.bidHistory || listing.bidHistory.length < 2) return null;
    const vals = listing.bidHistory;
    const min = Math.min(...vals);
    const max = Math.max(...vals) || min + 1;
    const w = 400, h = 70, pad = 8;
    return vals
      .map((v, i) => {
        const x = (i / (vals.length - 1)) * (w - pad * 2) + pad;
        const y = h - pad - ((v - min) / (max - min || 1)) * (h - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");
  }, [listing.bidHistory]);

  function submitBid() {
    const n = Number(bidValue);
    if (!bidValue || Number.isNaN(n) || n < minBid) {
      setBidError(`Nhập ít nhất ${formatCurrency(minBid)}`);
      return;
    }
    onBid(listing.id, n);
    setBidValue("");
    setBidError("");
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <Thumb category={listing.category} size="large" />
        <div className="modal-body">
          <div className="card-eyebrow font-mono">{meta.label} · {listing.location}</div>
          <h2 className="modal-title font-display">{listing.title}</h2>
          <div className="card-cond" style={{ margin: "10px 0" }}>
            <TreadBar fill={cond.fill} />
            <span className="font-mono cond-label">{cond.label}</span>
          </div>
          <p className="modal-desc font-body">{listing.description}</p>

          {listing.type === "auction" ? (
            <div className="auction-panel">
              <div className="auction-stats">
                <div>
                  <div className="stat-label font-mono">Giá hiện tại</div>
                  <div className="stat-value font-mono">{formatCurrency(listing.currentBid)}</div>
                </div>
                <div>
                  <div className="stat-label font-mono">Lượt đấu giá</div>
                  <div className="stat-value font-mono">{listing.bidCount}</div>
                </div>
                <div>
                  <div className="stat-label font-mono"><Clock size={11} style={{ display: "inline", marginRight: 3 }} />Thời gian còn lại</div>
                  <div className="stat-value font-mono">{formatTimeLeft(listing.bidEnd, nowMs)}</div>
                </div>
              </div>
              {chartPoints && (
                <svg viewBox="0 0 400 70" className="climb-chart" preserveAspectRatio="none">
                  <polyline points={chartPoints} fill="none" stroke="var(--route)" strokeWidth="2.5" />
                </svg>
              )}
              <div className="bid-row">
                <span className="font-mono bid-prefix">$</span>
                <input
                  type="number"
                  className="bid-input font-mono"
                  placeholder={String(minBid)}
                  value={bidValue}
                  onChange={(e) => setBidValue(e.target.value)}
                />
                <button className="btn-primary" onClick={submitBid}>Đấu giá</button>
              </div>
              {bidError && <div className="bid-error font-mono">{bidError}</div>}
              {listing.buyNow && (
                <button className="btn-secondary" style={{ marginTop: 10 }} onClick={() => onBuyNow(listing)}>
                  Mua ngay với {formatCurrency(listing.buyNow)}
                </button>
              )}
            </div>
          ) : (
            <div className="auction-panel">
              <div className="stat-label font-mono">Giá</div>
              <div className="stat-value font-mono" style={{ fontSize: 28 }}>{formatCurrency(listing.price)}</div>
              <button className="btn-primary" style={{ marginTop: 12 }} onClick={() => onBuyNow(listing)}>
                Mua ngay
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CheckoutModal({ listing, onClose, onConfirm }) {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    paymentMethod: "credit-card",
  });
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  function update(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function submit() {
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Vui lòng điền tất cả các trường bắt buộc.");
      return;
    }
    setConfirmed(true);
    setTimeout(() => {
      onConfirm({ ...form, listing });
    }, 800);
  }

  const price = listing.type === "fixed" ? listing.price : listing.currentBid;

  if (confirmed) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
          <div className="modal-body" style={{ textAlign: "center", paddingTop: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
            <h2 className="modal-title font-display">Đơn hàng xác nhận</h2>
            <p className="modal-desc">
              Cảm ơn bạn! Đơn hàng của bạn đã được xác nhận. Chúng tôi sẽ liên hệ với bạn sớm với chi tiết giao hàng.
            </p>
            <button className="btn-primary" onClick={onClose} style={{ marginTop: 16 }}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          <div className="card-eyebrow font-mono">Thanh toán</div>
          <h2 className="modal-title font-display">Xác nhận đơn hàng</h2>

          <div className="auction-panel" style={{ marginBottom: 20 }}>
            <div className="stat-label font-mono">Sản phẩm</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4, marginBottom: 10 }}>{listing.title}</div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #DADFD9" }}>
              <span className="font-mono">Tổng giá:</span>
              <span className="font-mono" style={{ fontSize: 18, fontWeight: 700 }}>{formatCurrency(price)}</span>
            </div>
          </div>

          <label className="field-label font-mono">Họ và tên</label>
          <input className="field-input font-body" value={form.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            placeholder="Nguyễn Văn A" />

          <label className="field-label font-mono">Email</label>
          <input className="field-input font-body" type="email" value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="abc@example.com" />

          <label className="field-label font-mono">Số điện thoại</label>
          <input className="field-input font-body" type="tel" value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+84 123 456 789" />

          <label className="field-label font-mono">Phương thức thanh toán</label>
          <select className="field-input font-body" value={form.paymentMethod}
            onChange={(e) => update("paymentMethod", e.target.value)}>
            <option value="credit-card">Thẻ tín dụng</option>
            <option value="debit-card">Thẻ ghi nợ</option>
            <option value="bank-transfer">Chuyển khoản ngân hàng</option>
            <option value="e-wallet">Ví điện tử</option>
          </select>

          {error && <div className="bid-error font-mono" style={{ marginTop: 12 }}>{error}</div>}
          
          <button className="btn-primary" style={{ marginTop: 18, width: "100%" }} onClick={submit}>
            Hoàn tất đơn hàng
          </button>
          <button className="btn-secondary" style={{ marginTop: 10, width: "100%" }} onClick={onClose}>
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

function SellForm({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    title: "", category: "road", type: "fixed", price: "", startingBid: "",
    durationDays: "3", condition: "well-ridden", location: "", description: "",
  });
  const [error, setError] = useState("");

  function update(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function submit() {
    if (!form.title.trim() || !form.location.trim() || !form.description.trim()) {
      setError("Vui lòng điền tên, vị trí và mô tả.");
      return;
    }
    if (form.type === "fixed" && (!form.price || Number(form.price) <= 0)) {
      setError("Nhập giá lớn hơn 0.");
      return;
    }
    if (form.type === "auction" && (!form.startingBid || Number(form.startingBid) <= 0)) {
      setError("Nhập giá khởi đấu lớn hơn 0.");
      return;
    }
    const base = {
      id: `l-${Date.now()}`,
      title: form.title.trim(),
      category: form.category,
      condition: form.condition,
      location: form.location.trim(),
      description: form.description.trim(),
      createdAt: Date.now(),
    };
    const listing =
      form.type === "fixed"
        ? { ...base, type: "fixed", price: Number(form.price) }
        : {
            ...base,
            type: "auction",
            startingBid: Number(form.startingBid),
            currentBid: Number(form.startingBid),
            buyNow: null,
            bidCount: 0,
            bidEnd: Date.now() + days(Number(form.durationDays)),
            bidHistory: [Number(form.startingBid)],
          };
    onSubmit(listing);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>
        <div className="modal-body" style={{ paddingTop: 8 }}>
          <div className="card-eyebrow font-mono">Liệt kê hàng của bạn</div>
          <h2 className="modal-title font-display">Bạn đang bán cái gì?</h2>

          <label className="field-label font-mono">Tiêu đề</label>
          <input className="field-input font-body" value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="ví dụ: 2020 Trek Domane SL6 — 54cm" />

          <div className="field-grid">
            <div>
              <label className="field-label font-mono">Danh mục</label>
              <select className="field-input font-body" value={form.category}
                onChange={(e) => update("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label font-mono">Tình trạng</label>
              <select className="field-input font-body" value={form.condition}
                onChange={(e) => update("condition", e.target.value)}>
                {CONDITIONS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <label className="field-label font-mono">Loại danh sách</label>
          <div className="type-toggle">
            <button className={form.type === "fixed" ? "toggle-on" : ""} onClick={() => update("type", "fixed")}>
              <Tag size={14} /> Giá cố định
            </button>
            <button className={form.type === "auction" ? "toggle-on" : ""} onClick={() => update("type", "auction")}>
              <Gavel size={14} /> Đấu giá
            </button>
          </div>

          {form.type === "fixed" ? (
            <div>
              <label className="field-label font-mono">Giá</label>
              <input type="number" className="field-input font-mono" value={form.price}
                onChange={(e) => update("price", e.target.value)} placeholder="450" />
            </div>
          ) : (
            <div className="field-grid">
              <div>
                <label className="field-label font-mono">Giá khởi đấu</label>
                <input type="number" className="field-input font-mono" value={form.startingBid}
                  onChange={(e) => update("startingBid", e.target.value)} placeholder="200" />
              </div>
              <div>
                <label className="field-label font-mono">Thời lượng</label>
                <select className="field-input font-body" value={form.durationDays}
                  onChange={(e) => update("durationDays", e.target.value)}>
                  <option value="1">1 ngày</option>
                  <option value="3">3 ngày</option>
                  <option value="5">5 ngày</option>
                  <option value="7">7 ngày</option>
                </select>
              </div>
            </div>
          )}

          <label className="field-label font-mono">Vị trí</label>
          <input className="field-input font-body" value={form.location}
            onChange={(e) => update("location", e.target.value)} placeholder="ví dụ: Thành phố Hồ Chí Minh" />

          <label className="field-label font-mono">Mô tả</label>
          <textarea className="field-input font-body" rows={4} value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Chi tiết tình trạng, nâng cấp, lý do bán…" />

          {error && <div className="bid-error font-mono">{error}</div>}
          <button className="btn-primary" style={{ marginTop: 14, width: "100%" }} onClick={submit}>
            Xuất bản danh sách
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Spoke() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [selected, setSelected] = useState(null);
  const [showSell, setShowSell] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [checkoutItem, setCheckoutItem] = useState(null);
  const [toast, setToast] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const toastTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await window.storage.get("spoke:listings", false);
        if (res && res.value) {
          if (!cancelled) setListings(JSON.parse(res.value));
        } else {
          throw new Error("no data");
        }
      } catch {
        if (!cancelled) setListings(SEED_LISTINGS);
        try { await window.storage.set("spoke:listings", JSON.stringify(SEED_LISTINGS), false); } catch {}
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  async function persist(next) {
    setListings(next);
    try { await window.storage.set("spoke:listings", JSON.stringify(next), false); } catch {}
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3200);
  }

  function handleBid(id, amount) {
    const next = listings.map((l) => {
      if (l.id !== id) return l;
      return {
        ...l,
        currentBid: amount,
        bidCount: (l.bidCount || 0) + 1,
        bidHistory: [...(l.bidHistory || []), amount],
      };
    });
    persist(next);
    setSelected((s) => (s ? next.find((l) => l.id === id) : s));
    showToast(`Đã đấu giá — bạn dẫn đầu với ${formatCurrency(amount)}`);
  }

  function handleBuyNow(listing) {
    setCheckoutItem(listing);
    setShowCheckout(true);
  }

  function handleCheckout(orderData) {
    setShowCheckout(false);
    showToast(`Đơn hàng đã tạo! Chúng tôi sẽ liên hệ với ${orderData.fullName} qua email sớm.`);
    setSelected(null);
  }

  function handleNewListing(listing) {
    const next = [listing, ...listings];
    persist(next);
    setShowSell(false);
    showToast("Danh sách đã xuất bản.");
  }

  function resetDemo() {
    persist(SEED_LISTINGS);
    showToast("Dữ liệu demo đã được đặt lại.");
  }

  const filtered = useMemo(() => {
    let out = listings.filter((l) => {
      if (category !== "all" && l.category !== category) return false;
      if (type !== "all" && l.type !== type) return false;
      if (search.trim() && !l.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
    if (sort === "newest") out = out.sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "price-asc") out = out.sort((a, b) => (a.type === "fixed" ? a.price : a.currentBid) - (b.type === "fixed" ? b.price : b.currentBid));
    if (sort === "ending-soon") out = out.sort((a, b) => (a.bidEnd || Infinity) - (b.bidEnd || Infinity));
    return out;
  }, [listings, category, type, search, sort]);

  return (
    <div className="spoke-app font-body">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');

        .spoke-app {
          --asphalt: #1C1F1E;
          --chalk: #EEF1EC;
          --route: #1B6F5C;
          --route-dark: #123F35;
          --flare: #E8572B;
          --steel: #7C8683;
          --caution: #F2B705;
          background: var(--chalk);
          color: var(--asphalt);
          min-height: 100vh;
        }
        .font-display { font-family: 'Oswald', sans-serif; }
        .font-body { font-family: 'Inter', sans-serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }

        .spoke-header {
          background: var(--asphalt);
          color: var(--chalk);
          padding: 18px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky; top: 0; z-index: 20;
        }
        .logo {
          font-family: 'Oswald', sans-serif;
          font-weight: 700;
          font-size: 22px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--chalk);
        }
        .logo span { color: var(--caution); }
        .btn-sell {
          background: var(--flare);
          color: white;
          border: none;
          padding: 9px 16px;
          border-radius: 3px;
          font-family: 'Oswald', sans-serif;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          font-size: 13px;
          display: flex; align-items: center; gap: 6px;
          cursor: pointer;
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .btn-sell:hover { background: #d24a1f; transform: translateY(-1px); }

        .hero {
          background: var(--asphalt);
          color: var(--chalk);
          padding: 56px 20px 0;
          text-align: center;
        }
        .hero h1 {
          font-family: 'Oswald', sans-serif;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.02em;
          font-size: clamp(32px, 6vw, 56px);
          margin: 0 0 12px;
        }
        .hero p {
          color: #C7CDC9;
          max-width: 520px;
          margin: 0 auto 26px;
          font-size: 16px;
          line-height: 1.5;
        }
        .search-wrap {
          max-width: 520px;
          margin: 0 auto 30px;
          background: #2A2E2C;
          border: 1px solid #3C4340;
          border-radius: 4px;
          display: flex;
          align-items: center;
          padding: 10px 14px;
          gap: 10px;
        }
        .search-wrap input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--chalk);
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          width: 100%;
        }
        .search-wrap input::placeholder { color: #7A827F; }

        .elevation-svg { display: block; }
        .elevation-path {
          stroke-dasharray: 1400;
          stroke-dashoffset: 1400;
        }
        @media (prefers-reduced-motion: no-preference) {
          .elevation-path { animation: draw 1.6s ease forwards 0.15s; }
        }
        @keyframes draw { to { stroke-dashoffset: 0; } }

        .cat-row {
          display: flex; gap: 10px; overflow-x: auto;
          padding: 18px 20px; background: var(--chalk);
          border-bottom: 1px solid #DADFD9;
        }
        .cat-chip {
          display: flex; align-items: center; gap: 7px;
          background: white; border: 1px solid #DADFD9;
          padding: 8px 14px; border-radius: 999px;
          font-family: 'Oswald', sans-serif; font-size: 13px;
          letter-spacing: 0.02em; text-transform: uppercase;
          white-space: nowrap; cursor: pointer;
          transition: transform 0.12s ease, border-color 0.12s ease;
        }
        .cat-chip:hover { transform: translateY(-1px); }
        .cat-chip.active { background: var(--route); color: white; border-color: var(--route); }

        .filter-bar {
          display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
          padding: 14px 20px; background: var(--chalk);
        }
        .type-pill {
          display: flex; border: 1px solid #C7CDC9; border-radius: 4px; overflow: hidden;
        }
        .type-pill button {
          border: none; background: white; padding: 7px 14px; cursor: pointer;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
        }
        .type-pill button.active { background: var(--asphalt); color: white; }
        .sort-select {
          border: 1px solid #C7CDC9; border-radius: 4px; padding: 7px 10px;
          font-family: 'JetBrains Mono', monospace; font-size: 12px; background: white;
        }
        .result-count { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--steel); margin-left: auto; }

        .grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 18px; padding: 6px 20px 40px;
        }
        .card {
          background: white; border: 1px solid #DADFD9; border-radius: 6px;
          overflow: hidden; text-align: left; cursor: pointer; padding: 0;
          display: flex; flex-direction: column;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(28,31,30,0.12); }
        .thumb {
          height: 130px; display: flex; align-items: center; justify-content: center;
          position: relative; overflow: hidden;
        }
        .thumb-texture {
          position: absolute; inset: 0;
          background: repeating-linear-gradient(-15deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 2px, transparent 2px, transparent 14px);
        }
        .card-body { padding: 14px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
        .card-eyebrow { font-size: 11px; color: var(--steel); text-transform: uppercase; letter-spacing: 0.04em; }
        .card-title { font-size: 15px; font-weight: 600; line-height: 1.3; margin: 0; }
        .card-cond { display: flex; align-items: center; gap: 8px; }
        .cond-label { font-size: 11px; color: var(--steel); }
        .tread-bar { display: flex; gap: 2px; }
        .tread-seg { width: 8px; height: 8px; border-radius: 1px; background: #DADFD9; }
        .tread-on { background: var(--route); }
        .card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 6px; }
        .card-price { font-size: 17px; font-weight: 700; }
        .badge {
          font-family: 'JetBrains Mono', monospace; font-size: 10.5px;
          display: flex; align-items: center; gap: 4px;
          padding: 4px 8px; border-radius: 999px;
        }
        .badge-auction { background: #FDF1D6; color: #8a6600; }
        .badge-fixed { background: #E4F1EC; color: var(--route-dark); }
        .card-meta { display: flex; align-items: center; gap: 4px; font-size: 10.5px; color: var(--steel); }

        .overlay {
          position: fixed; inset: 0; background: rgba(20,22,21,0.6);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 50; overflow-y: auto;
        }
        .modal {
          background: white; border-radius: 8px; max-width: 560px; width: 100%;
          max-height: 90vh; overflow-y: auto; position: relative;
        }
        .modal-close {
          position: absolute; top: 12px; right: 12px; background: white;
          border: 1px solid #DADFD9; border-radius: 50%; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 5;
        }
        .modal-body { padding: 20px 22px 26px; }
        .modal-title { font-size: 24px; margin: 4px 0 6px; text-transform: none; }
        .modal-desc { font-size: 14px; line-height: 1.6; color: #3A3E3C; margin: 10px 0 16px; }
        .auction-panel { background: var(--chalk); border-radius: 6px; padding: 16px; margin-top: 10px; }
        .auction-stats { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .stat-label { font-size: 10.5px; color: var(--steel); text-transform: uppercase; letter-spacing: 0.03em; }
        .stat-value { font-size: 20px; font-weight: 700; margin-top: 2px; }
        .climb-chart { width: 100%; height: 50px; margin: 8px 0; }
        .bid-row { display: flex; align-items: center; gap: 8px; margin-top: 8px; }
        .bid-prefix { color: var(--steel); }
        .bid-input {
          flex: 1; border: 1px solid #C7CDC9; border-radius: 4px; padding: 9px 10px; font-size: 14px;
        }
        .bid-error { color: var(--flare); font-size: 12px; margin-top: 6px; }
        .btn-primary {
          background: var(--route); color: white; border: none; padding: 10px 18px;
          border-radius: 4px; font-family: 'Oswald', sans-serif; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.03em; font-size: 13px; cursor: pointer;
        }
        .btn-primary:hover { background: var(--route-dark); }
        .btn-secondary {
          background: white; color: var(--asphalt); border: 1px solid #C7CDC9; padding: 10px 18px;
          border-radius: 4px; font-family: 'Oswald', sans-serif; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.03em; font-size: 13px; cursor: pointer; width: 100%;
        }

        .field-label { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; color: var(--steel); margin: 12px 0 4px; }
        .field-input {
          width: 100%; border: 1px solid #C7CDC9; border-radius: 4px; padding: 9px 10px; font-size: 14px; box-sizing: border-box;
        }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .type-toggle { display: flex; gap: 8px; margin-top: 4px; }
        .type-toggle button {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 9px; border: 1px solid #C7CDC9; border-radius: 4px; background: white; cursor: pointer;
          font-family: 'JetBrains Mono', monospace; font-size: 12px;
        }
        .type-toggle .toggle-on { background: var(--asphalt); color: white; border-color: var(--asphalt); }

        .toast {
          position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
          background: var(--asphalt); color: white; padding: 12px 20px; border-radius: 999px;
          font-family: 'JetBrains Mono', monospace; font-size: 13px; z-index: 60;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }
        .footer {
          text-align: center; padding: 24px; color: var(--steel); font-size: 12px;
          display: flex; align-items: center; justify-content: center; gap: 6px;
        }
        .footer button {
          background: none; border: none; color: var(--route-dark); cursor: pointer;
          display: flex; align-items: center; gap: 4px; font-size: 12px; font-family: 'JetBrains Mono', monospace;
        }
        .empty-state { text-align: center; padding: 60px 20px; color: var(--steel); }
      `}</style>

      <header className="spoke-header">
        <div className="logo">SPOKE<span>.</span></div>
        <button className="btn-sell" onClick={() => setShowSell(true)}>
          <Plus size={15} /> Bán hàng
        </button>
      </header>

      <section className="hero">
        <h1>Xe đạp của bạn<br />có giá trị.</h1>
        <p>Liệt kê chiếc xe nằm im lìm, đấu giá chiếc xe gravel tiếp theo, hoặc tìm một bộ truyền động bị ngừng sản xuất. Được xây dựng bởi các cua rơ, cho các cua rơ.</p>
        <div className="search-wrap">
          <Search size={16} color="#7A827F" />
          <input
            placeholder="Tìm kiếm khung, bộ truyền, áo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <ElevationDivider />
      </section>

      <nav className="cat-row">
        <div className={`cat-chip ${category === "all" ? "active" : ""}`} onClick={() => setCategory("all")}>
          Tất cả hàng
        </div>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.key} className={`cat-chip ${category === c.key ? "active" : ""}`} onClick={() => setCategory(c.key)}>
              <Icon size={14} /> {c.label}
            </div>
          );
        })}
      </nav>

      <div className="filter-bar">
        <div className="type-pill">
          <button className={type === "all" ? "active" : ""} onClick={() => setType("all")}>Tất cả</button>
          <button className={type === "fixed" ? "active" : ""} onClick={() => setType("fixed")}>Mua ngay</button>
          <button className={type === "auction" ? "active" : ""} onClick={() => setType("auction")}>Đấu giá</button>
        </div>
        <select className="sort-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">Mới nhất</option>
          <option value="price-asc">Giá: thấp đến cao</option>
          <option value="ending-soon">Kết thúc sớm nhất</option>
        </select>
        <div className="result-count">{loading ? "Đang tải…" : `${filtered.length} danh sách`}</div>
      </div>

      {!loading && filtered.length === 0 ? (
        <div className="empty-state font-mono">
          Chưa có hàng phù hợp với các bộ lọc này. Hãy thử xóa bộ lọc hoặc là người đầu tiên liệt kê.
        </div>
      ) : (
        <div className="grid">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} nowMs={nowMs} onOpen={setSelected} />
          ))}
        </div>
      )}

      <div className="footer">
        Thị trường demo — thanh toán hoạt động.
        <button onClick={resetDemo}><RotateCcw size={12} /> Đặt lại dữ liệu</button>
      </div>

      {selected && (
        <DetailModal
          listing={selected}
          nowMs={nowMs}
          onClose={() => setSelected(null)}
          onBid={handleBid}
          onBuyNow={handleBuyNow}
        />
      )}
      {showCheckout && checkoutItem && (
        <CheckoutModal
          listing={checkoutItem}
          onClose={() => setShowCheckout(false)}
          onConfirm={handleCheckout}
        />
      )}
      {showSell && <SellForm onClose={() => setShowSell(false)} onSubmit={handleNewListing} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * Reusable "dimensional portal" entrance wrapper.
 * Wrap a grid in <PortalRevealGroup> and each item in <PortalReveal index={i}>.
 * The portal is pure CSS (gradients + pseudo elements) — no image assets.
 */

export function PortalRevealGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function useTier() {
  const [tier, setTier] = useState<"desktop" | "tablet" | "mobile">("desktop");
  useEffect(() => {
    const read = () => {
      const w = window.innerWidth;
      setTier(w < 768 ? "mobile" : w < 1180 ? "tablet" : "desktop");
    };
    read();
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);
  return tier;
}

export function PortalReveal({
  children,
  index = 0,
  className,
  stagger = 0.12,
}: {
  children: ReactNode;
  index?: number;
  className?: string;
  stagger?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);
  const reduced = useReducedMotion();
  const tier = useTier();
  const [burst, setBurst] = useState(false);
  const [settled, setSettled] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const delay = index * stagger;

  useEffect(() => {
    if (!inView) return;
    const total = (delay + (reduced ? 0.4 : 1.0)) * 1000;
    const t1 = window.setTimeout(() => setBurst(true), total - 220);
    const t2 = window.setTimeout(() => {
      setBurst(false);
      setSettled(true);
    }, total + 520);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [inView, delay, reduced]);

  const particles = tier === "desktop" ? 6 : tier === "tablet" ? 3 : 0;
  const tiltEnabled = tier === "desktop" && !reduced;

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tiltEnabled) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 8, y: px * 8 });
  };

  const initial = reduced
    ? { opacity: 0, y: 16 }
    : { opacity: 0, scale: 0.65, filter: "blur(10px)", rotateX: 14, rotateY: -10, z: -120 };

  const animate = reduced
    ? { opacity: 1, y: 0 }
    : { opacity: 1, scale: [0.65, 1.05, 1], filter: "blur(0px)", rotateX: 0, rotateY: 0, z: 0 };

  return (
    <div ref={ref} className={`portal-reveal ${className ?? ""}`}>
      {!reduced && !settled && (
        <div className={`portal-fx ${inView ? "is-active" : ""} ${burst ? "is-burst" : ""}`} aria-hidden style={{ animationDelay: `${delay}s`, ["--pd" as string]: `${delay}s` }}>
          <span className="portal-core" />
          <span className="portal-ring portal-ring-1" />
          <span className="portal-ring portal-ring-2" />
          <span className="portal-ring portal-ring-3" />
          {Array.from({ length: particles }).map((_, i) => (
            <span key={i} className="portal-spark" style={{ ["--i" as string]: i, ["--n" as string]: particles }} />
          ))}
        </div>
      )}

      <motion.div
        className="portal-card-shell"
        style={{ transformPerspective: 900 }}
        initial={initial}
        animate={inView ? animate : initial}
        transition={
          reduced
            ? { duration: 0.45, delay, ease: "easeOut" }
            : { duration: 1.0, delay, ease: [0.16, 0.9, 0.24, 1], filter: { duration: 0.7, delay: delay + 0.1 } }
        }
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <motion.div
          className="portal-tilt"
          animate={{ rotateX: tilt.x, rotateY: tilt.y, y: tilt.x || tilt.y ? -6 : 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 20, mass: 0.5 }}
          style={{ transformPerspective: 900 }}
        >
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

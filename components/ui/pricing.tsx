"use client";

import { motion } from "framer-motion";
import React, {
  useState,
  useRef,
  useEffect,
  createContext,
  useContext,
} from "react";
import confetti from "canvas-confetti";
import Link from "next/link";
import { Check, Star as LucideStar } from "lucide-react";
import NumberFlow from "@number-flow/react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- UTILITY FUNCTIONS ---

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useMediaQuery(query: string) {
  const [value, setValue] = useState(false);

  useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener("change", onChange);
    setValue(result.matches);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}

// --- BASE UI COMPONENTS (BUTTON) ---

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";


// --- PRICING COMPONENT LOGIC ---

// Interfaces
interface PricingPlan {
  name: string;
  price: string;
  yearlyPrice: string;
  period: string;
  features: string[];
  description: string;
  buttonText: string;
  href: string;
  isPopular?: boolean;
}

interface PricingSectionProps {
  plans: PricingPlan[];
  title?: string;
  description?: string;
  onPlanSelect?: (planId: string, isMonthly: boolean) => void;
}

// Context for state management
const PricingContext = createContext<{
  isMonthly: boolean;
  setIsMonthly: (value: boolean) => void;
  onPlanSelect?: (planId: string, isMonthly: boolean) => void;
}>({
  isMonthly: true,
  setIsMonthly: () => {},
});

// Main PricingSection Component
export function PricingSection({
  plans,
  title = "Simple, Transparent Pricing",
  description = "Choose the plan that's right for you. All plans include our core features and support.",
  onPlanSelect,
}: PricingSectionProps) {
  const [isMonthly, setIsMonthly] = useState(true);

  return (
    <PricingContext.Provider value={{ isMonthly, setIsMonthly, onPlanSelect }}>
      <div className="relative w-full bg-background dark:bg-neutral-950 py-20 sm:py-24">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
            <h2 className="text-4xl font-bold tracking-tighter sm:text-5xl text-neutral-900 dark:text-white">
              {title}
            </h2>
            <p className="text-muted-foreground text-lg whitespace-pre-line">
              {description}
            </p>
          </div>
          <PricingToggle />
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 items-stretch gap-8">
            {plans.map((plan, index) => (
              <PricingCard key={index} plan={plan} index={index} />
            ))}
          </div>
        </div>
      </div>
    </PricingContext.Provider>
  );
}

// Pricing Toggle Component
function PricingToggle() {
  const { isMonthly, setIsMonthly } = useContext(PricingContext);
  const confettiRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    const newValue = !isMonthly;
    setIsMonthly(newValue);

    if (!newValue && confettiRef.current) {
      const rect = confettiRef.current.getBoundingClientRect();
      const originX = (rect.left + rect.width / 2) / window.innerWidth;
      const originY = (rect.top + rect.height / 2) / window.innerHeight;

      confetti({
        particleCount: 80,
        spread: 80,
        origin: { x: originX, y: originY },
        colors: [
          "hsl(var(--primary))",
          "hsl(var(--background))",
          "hsl(var(--accent))",
        ],
        ticks: 300,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 30,
      });
    }
  };

  return (
    <div className="flex flex-col items-center gap-4" ref={confettiRef}>
      {/* 토글 컨테이너 */}
      <div className="relative inline-flex items-center bg-neutral-900 border border-neutral-700 rounded-full p-1">
        {/* 슬라이딩 배경 */}
        <motion.div
          className="absolute top-1 bottom-1 rounded-full bg-white"
          initial={false}
          animate={{
            left: isMonthly ? 4 : "calc(50% + 2px)",
            right: isMonthly ? "calc(50% + 2px)" : 4,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />

        {/* 월간 버튼 */}
        <button
          onClick={() => handleToggle()}
          className={cn(
            "relative z-10 px-6 py-2.5 rounded-full text-sm font-medium transition-colors min-w-[100px]",
            isMonthly ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-200"
          )}
        >
          월간 결제
        </button>

        {/* 연간 버튼 */}
        <button
          onClick={() => handleToggle()}
          className={cn(
            "relative z-10 px-6 py-2.5 rounded-full text-sm font-medium transition-colors min-w-[100px]",
            !isMonthly ? "text-neutral-900" : "text-neutral-400 hover:text-neutral-200"
          )}
        >
          연간 결제
        </button>
      </div>

      {/* 할인 뱃지 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: !isMonthly ? 1 : 0.5, y: 0 }}
        className={cn(
          "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
          !isMonthly
            ? "bg-green-500 text-white"
            : "bg-neutral-800 text-neutral-400"
        )}
      >
        연간 결제 시 20% 할인
      </motion.div>
    </div>
  );
}

// Pricing Card Component
function PricingCard({ plan, index }: { plan: PricingPlan; index: number }) {
  const { isMonthly, onPlanSelect } = useContext(PricingContext);

  const handleClick = () => {
    if (onPlanSelect) {
      onPlanSelect(plan.name.toLowerCase(), isMonthly);
    }
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      whileInView={{
        y: 0,
        opacity: 1,
      }}
      viewport={{ once: true }}
      transition={{
        duration: 0.6,
        type: "spring",
        stiffness: 100,
        damping: 20,
        delay: index * 0.15,
      }}
      className={cn(
        "rounded-2xl p-8 flex flex-col relative bg-background/70 backdrop-blur-sm h-full",
        plan.isPopular
          ? "border-2 border-primary shadow-xl"
          : "border border-border",
      )}
    >
      {plan.isPopular && (
        <div className="absolute top-0 -translate-y-1/2 left-1/2 -translate-x-1/2">
          <div className="bg-primary py-1.5 px-4 rounded-full flex items-center gap-1.5">
            <LucideStar className="text-primary-foreground h-4 w-4 fill-current" />
            <span className="text-primary-foreground text-sm font-semibold">
              Most Popular
            </span>
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col text-center">
        <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {plan.description}
        </p>
        <div className="mt-6 flex items-baseline justify-center gap-x-1">
          <span className="text-5xl font-bold tracking-tight text-foreground">
            <NumberFlow
              value={
                isMonthly ? Number(plan.price) : Number(plan.yearlyPrice)
              }
              format={{
                style: "currency",
                currency: "KRW",
                minimumFractionDigits: 0,
              }}
              className="font-variant-numeric: tabular-nums"
            />
          </span>
          <span className="text-sm font-semibold leading-6 tracking-wide text-muted-foreground">
            / {plan.period}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {isMonthly ? "월간 결제" : "연간 결제"}
        </p>

        <ul
          role="list"
          className="mt-8 space-y-3 text-sm leading-6 text-left text-muted-foreground"
        >
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-x-3">
              <Check
                className="h-6 w-5 flex-none text-primary"
                aria-hidden="true"
              />
              {feature}
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          {onPlanSelect ? (
            <button
              onClick={handleClick}
              className={cn(
                buttonVariants({
                  variant: plan.isPopular ? "default" : "outline",
                  size: "lg",
                }),
                "w-full",
              )}
            >
              {plan.buttonText}
            </button>
          ) : (
            <Link
              href={plan.href}
              className={cn(
                buttonVariants({
                  variant: plan.isPopular ? "default" : "outline",
                  size: "lg",
                }),
                "w-full",
              )}
            >
              {plan.buttonText}
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}

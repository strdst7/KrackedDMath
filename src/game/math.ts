export type Op = "+" | "−" | "×" | "÷";

export interface Problem {
  equation: string;
  answer: number;
  answerStr: string;
  options: number[];
  tier: number;
  op: Op;
}

const OPS: Op[] = ["+", "−", "×", "÷"];

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

function makeOptions(answer: number): number[] {
  const offsets = [-10, 10, -1, 1, -2, 2, -3, 3, -5, 5, -4, 4].sort(
    () => Math.random() - 0.5,
  );
  const set = new Set<number>([answer]);
  for (const off of offsets) {
    const v = answer + off;
    if (v > 0) set.add(v);
    if (set.size >= 4) break;
  }
  let step = 6;
  while (set.size < 4) {
    if (answer - step > 0 && !set.has(answer - step)) set.add(answer - step);
    else if (!set.has(answer + step)) set.add(answer + step);
    step++;
  }
  return Array.from(set).sort(() => Math.random() - 0.5).slice(0, 4);
}

export function generateProblem(tierInput = 2): Problem {
  const tier = Math.max(1, Math.min(4, Math.round(tierInput)));
  const op = pick(OPS);
  let a = 0;
  let b = 0;
  let ans = 0;

  switch (tier) {
    case 1:
      switch (op) {
        case "+":
          a = randInt(4, 12);
          b = randInt(3, 9);
          ans = a + b;
          break;
        case "−":
          ans = randInt(2, 11);
          b = randInt(3, 9);
          a = ans + b;
          break;
        case "×":
          a = randInt(2, 5);
          b = randInt(3, 6);
          ans = a * b;
          break;
        case "÷":
          b = randInt(2, 5);
          ans = randInt(2, 6);
          a = b * ans;
          break;
      }
      break;
    case 2:
      switch (op) {
        case "+":
          a = randInt(18, 48);
          b = randInt(14, 45);
          ans = a + b;
          break;
        case "−":
          a = randInt(42, 92);
          b = randInt(16, a - 12);
          ans = a - b;
          break;
        case "×":
          a = randInt(6, 9);
          b = randInt(4, 9);
          ans = a * b;
          break;
        case "÷":
          b = randInt(6, 9);
          ans = randInt(4, 9);
          a = b * ans;
          break;
      }
      break;
    case 3:
      switch (op) {
        case "+":
          a = randInt(48, 89);
          b = randInt(36, 78);
          ans = a + b;
          break;
        case "−":
          a = randInt(112, 185);
          b = randInt(38, a - 30);
          ans = a - b;
          break;
        case "×":
          a = randInt(11, 16);
          b = randInt(4, 9);
          ans = a * b;
          break;
        case "÷":
          b = randInt(4, 9);
          ans = randInt(11, 16);
          a = b * ans;
          break;
      }
      break;
    default:
      switch (op) {
        case "+":
          a = randInt(125, 340);
          b = randInt(85, 260);
          ans = a + b;
          break;
        case "−":
          a = randInt(210, 480);
          b = randInt(85, a - 50);
          ans = a - b;
          break;
        case "×":
          a = randInt(14, 25);
          b = randInt(6, 12);
          ans = a * b;
          break;
        case "÷":
          b = randInt(7, 13);
          ans = randInt(11, 18);
          a = b * ans;
          break;
      }
  }

  return {
    equation: `${a} ${op} ${b} = ?`,
    answer: ans,
    answerStr: String(ans),
    options: makeOptions(ans),
    tier,
    op,
  };
}

export const COMPLEXITY = [
  {
    id: 1,
    label: "Complexity: Novice",
    name: "Novice",
    description: "Single-digit & doubles",
    minThinkMs: 1200,
    spanThinkMs: 600,
  },
  {
    id: 2,
    label: "Complexity: Standard",
    name: "Standard",
    description: "2-digit sums & tables",
    minThinkMs: 1800,
    spanThinkMs: 800,
  },
  {
    id: 3,
    label: "Complexity: Advanced",
    name: "Advanced",
    description: "Regrouping & teen products",
    minThinkMs: 2500,
    spanThinkMs: 1000,
  },
  {
    id: 4,
    label: "Complexity: Master",
    name: "Master",
    description: "Large products & mental math",
    minThinkMs: 3400,
    spanThinkMs: 1200,
  },
] as const;

export const MODES = [
  {
    id: "1p-vs-ai" as const,
    label: "Mode: 1P vs Bot",
    leftAI: false,
    rightAI: true,
  },
  {
    id: "ai-vs-ai" as const,
    label: "Mode: Bot vs Bot",
    leftAI: true,
    rightAI: true,
  },
  {
    id: "2p-duel" as const,
    label: "Mode: 2P Duel",
    leftAI: false,
    rightAI: false,
  },
];

export type ModeId = (typeof MODES)[number]["id"];

/** Shared-problem tier used by the online duel: escalates with the hotter streak. */
export function tierForStreak(baseTier: number, streak: number): number {
  return Math.max(1, Math.min(4, baseTier + Math.floor(streak / 3)));
}

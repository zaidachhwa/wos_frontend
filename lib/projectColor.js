const PALETTE = ["--cal-proj-1", "--cal-proj-2", "--cal-proj-3", "--cal-proj-4", "--cal-proj-5", "--cal-proj-6"];

// Deterministic name -> palette slot, so the same project always gets the
// same color across renders and users without persisting a color per project.
export const projectColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return `var(${PALETTE[Math.abs(hash) % PALETTE.length]})`;
};

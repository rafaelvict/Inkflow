import "./ExcalidrawLogo.scss";

const LogoIcon = () => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-icon"
  >
    {/* Pen nib body */}
    <path
      d="M8 32 L20 6 L28 14 Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    {/* Pen nib tip line */}
    <path
      d="M20 6 L24 10"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    />
    {/* Ink drop */}
    <ellipse
      cx="10"
      cy="33"
      rx="3"
      ry="4"
      fill="currentColor"
      opacity="0.75"
    />
    {/* Nib slit */}
    <line
      x1="14"
      y1="26"
      x2="20"
      y2="14"
      stroke="currentColor"
      strokeWidth="0.8"
      opacity="0.5"
      strokeLinecap="round"
    />
  </svg>
);

const LogoText = () => (
  <svg
    viewBox="0 0 450 55"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    className="ExcalidrawLogo-text"
  >
    <text
      x="0"
      y="42"
      fontFamily="Assistant, system-ui, sans-serif"
      fontWeight="600"
      fontSize="48"
      fill="currentColor"
      letterSpacing="-1"
    >
      InkFlow
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
}

export const ExcalidrawLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};

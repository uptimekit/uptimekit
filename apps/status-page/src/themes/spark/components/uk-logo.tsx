import type { SVGProps } from "react";

const UPTIMEKIT_LOGO_PATH =
    "M300 142.917C134.314 142.917 0 270.889 0 428.75V1286.25C0 1444.11 134.314 1572.08 300 1572.08H1200C1365.69 1572.08 1500 1444.11 1500 1286.25V428.75C1500 270.889 1365.69 142.917 1200 142.917H300ZM412.5 696.719H786.169L346.209 1115.9L478.793 1242.22L918.75 823.039V1179.06H1106.25V607.396C1106.25 558.065 1064.28 518.073 1012.5 518.073H412.5V696.719Z";
type LogoProps = Omit<SVGProps<SVGSVGElement>, "height" | "width">;

export const Logo = (props: LogoProps) => (
    <svg
        aria-label="UptimeKit"
        fill="#787882"
        height={24}
        role="img"
        viewBox="0 0 1500 1715"
        width={114}
        {...props}
    >
        <path clipRule="evenodd" d={UPTIMEKIT_LOGO_PATH} fillRule="evenodd" />
    </svg>
);

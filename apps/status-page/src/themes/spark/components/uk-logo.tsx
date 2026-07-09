import Image, { type ImageProps } from "next/image";

const UPTIMEKIT_LOGO_URL = "/logos_uptimekit.svg";
type LogoProps = Omit<ImageProps, "alt" | "height" | "src" | "width">;

export const LogoIcon = (props: LogoProps) => (
    <Image
        alt="UptimeKit"
        height={24}
        src={UPTIMEKIT_LOGO_URL}
        unoptimized
        width={29}
        {...props}
    />
);

export const Logo = (props: LogoProps) => (
    <Image
        alt="UptimeKit"
        height={24}
        src={UPTIMEKIT_LOGO_URL}
        unoptimized
        width={114}
        {...props}
    />
);

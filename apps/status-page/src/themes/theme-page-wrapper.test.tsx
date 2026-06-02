import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemePageWrapper } from "./theme-page-wrapper";

function TestTheme() {
	return <main>Status page</main>;
}

describe("ThemePageWrapper", () => {
	it("renders custom CSS from status page design", () => {
		const markup = renderToStaticMarkup(
			<ThemePageWrapper
				themeId="default"
				theme="light"
				ThemeComponent={TestTheme}
				componentProps={{
					data: {
						config: {
							design: {
								customCss: ".status-page-header { color: red; }",
							},
						},
					},
				}}
			/>,
		);

		expect(markup).toContain("data-uptimekit-custom-css");
		expect(markup).toContain(".status-page-header { color: red; }");
	});

	it("escapes closing style tags in custom CSS text", () => {
		const markup = renderToStaticMarkup(
			<ThemePageWrapper
				themeId="default"
				ThemeComponent={TestTheme}
				componentProps={{
					data: {
						config: {
							design: {
								customCss: "</style><script>alert(1)</script>",
							},
						},
					},
				}}
			/>,
		);

		expect(markup).toContain("</\\73 tyle><script>alert(1)</script>");
		expect(markup).not.toContain("</style><script>alert(1)</script>");
	});
});

import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export default function Loader() {
	return (
		<div className="flex h-full items-center justify-center pt-8">
			<FontAwesomeIcon icon={faSpinner} className="animate-spin" />
		</div>
	);
}

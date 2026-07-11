import {
  CheckCircle2,
  PhoneCall,
  PhoneOff,
  SkipForward,
  Square,
  X,
} from "lucide-react";

const keypadLabels = {
  consent: {
    1: "Continue",
    9: "Opt Out",
  },

  service: {
    1: "Mutual Funds",
    2: "SIP",
    3: "Trading Account",
    4: "Request Callback",
    9: "Not Interested",
  },

  existing_customer: {
    1: "Yes",
    2: "No",
  },

  callback: {
    1: "Yes, Call Me",
    2: "No Callback",
  },
};

function formatPhone(phone = "") {
  const value = String(phone);

  if (value.startsWith("91") && value.length === 12) {
    return `+91 ${value.slice(2, 7)} ${value.slice(7)}`;
  }

  return value;
}

function getDigitLabel(step, digit) {
  return keypadLabels[step]?.[digit] || "";
}

export default function MockCallModal({
  activeCall,
  loading,
  campaignActive,
  campaignPosition,
  campaignTotal,
  hasNextCustomer,
  onDigit,
  onEnd,
  onClose,
  onNextCustomer,
  onFinishCampaign,
  onStopCampaign,
}) {
  if (!activeCall) {
    return null;
  }

  const call = activeCall;

  const prompt = call.prompt || {
    message: "Call in progress",
    validDigits: [],
  };

  const completed =
    call.callStep === "completed" ||
    ["completed", "opted_out", "failed"].includes(
      call.callStatus
    );

  function handleHeaderClose() {
    if (campaignActive) {
      onStopCampaign();
      return;
    }

    if (completed) {
      onClose();
      return;
    }

    onEnd();
  }

  return (
    <div className="call-modal-backdrop">
      <div className="call-modal">
        <div className="call-modal-header">
          <div>
            <p className="call-modal-eyebrow">
              {campaignActive
                ? `Campaign Call ${campaignPosition} of ${campaignTotal}`
                : "Mock IVR Call"}
            </p>

            <h2>
              {call.customerName || "Geojit Customer"}
            </h2>

            <span>{formatPhone(call.phone)}</span>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={handleHeaderClose}
            disabled={loading}
            aria-label="Close call"
          >
            <X size={19} />
          </button>
        </div>

        <div className="call-status-area">
          <div
            className={`call-status-icon ${
              completed ? "call-completed-icon" : ""
            }`}
          >
            {completed ? (
              <CheckCircle2 size={27} />
            ) : (
              <PhoneCall size={27} />
            )}
          </div>

          <div>
            <strong>
              {completed
                ? call.callStatus === "opted_out"
                  ? "Customer opted out"
                  : call.callStatus === "failed"
                    ? "Call ended"
                    : "Call completed"
                : "Call in progress"}
            </strong>

            <span>
              Step:{" "}
              {(call.callStep || "unknown").replaceAll(
                "_",
                " "
              )}
            </span>
          </div>
        </div>

        <div className="ivr-prompt">
          <span>Voice prompt</span>
          <p>{prompt.message}</p>
        </div>

        {!completed &&
          prompt.validDigits?.length > 0 && (
            <>
              <p className="keypad-instruction">
                Simulate the customer pressing a keypad
                option:
              </p>

              <div className="keypad-grid">
                {prompt.validDigits.map((digit) => {
                  const label = getDigitLabel(
                    call.callStep,
                    digit
                  );

                  return (
                    <button
                      key={digit}
                      className={`keypad-button ${
                        digit === "9"
                          ? "keypad-danger"
                          : ""
                      }`}
                      type="button"
                      onClick={() => onDigit(digit)}
                      disabled={loading}
                    >
                      <strong>{digit}</strong>

                      {label && <span>{label}</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}

        {completed && (
          <div className="call-result">
            <div>
              <span>Selected service</span>

              <strong>
                {call.selectedServiceLabel ||
                  (call.selectedService
                    ? call.selectedService.replaceAll(
                        "_",
                        " "
                      )
                    : "Not selected")}
              </strong>
            </div>

            <div>
              <span>Existing customer</span>

              <strong>
                {call.answers?.existingCustomer
                  ? call.answers.existingCustomer
                  : "Not answered"}
              </strong>
            </div>

            <div>
              <span>Callback requested</span>

              <strong>
                {call.callbackRequested ? "Yes" : "No"}
              </strong>
            </div>

            <div>
              <span>Call duration</span>

              <strong>
                {Number(call.callDuration || 0)} seconds
              </strong>
            </div>
          </div>
        )}

        <div className="call-modal-actions">
          {!completed ? (
            <button
              className="end-call-button"
              type="button"
              onClick={onEnd}
              disabled={loading}
            >
              {campaignActive ? (
                <SkipForward size={17} />
              ) : (
                <PhoneOff size={17} />
              )}

              {campaignActive
                ? "Skip and Call Next"
                : "End Call"}
            </button>
          ) : campaignActive &&
            hasNextCustomer ? (
            <div className="campaign-modal-actions">
              <button
                className="modal-stop-campaign"
                type="button"
                onClick={onStopCampaign}
                disabled={loading}
              >
                <Square size={16} />
                Stop Campaign
              </button>

              <button
                className="primary-button"
                type="button"
                onClick={onNextCustomer}
                disabled={loading}
              >
                <SkipForward size={17} />
                Next Customer
              </button>
            </div>
          ) : campaignActive ? (
            <button
              className="primary-button"
              type="button"
              onClick={onFinishCampaign}
              disabled={loading}
            >
              <CheckCircle2 size={17} />
              Finish Campaign
            </button>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={onClose}
              disabled={loading}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
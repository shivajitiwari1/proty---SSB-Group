(function () {
    "use strict";

    function setStatus(element, type, message) {
        if (!element) return;

        element.textContent = message || "";
        element.classList.remove("is-success", "is-error", "is-visible");

        if (message) {
            element.classList.add(type === "success" ? "is-success" : "is-error", "is-visible");
        }
    }

    function setLoading(button, loading, loadingText) {
        if (!button) return;

        if (loading) {
            button.dataset.originalHtml = button.innerHTML;
            button.disabled = true;
            button.classList.add("is-loading");
            button.textContent = loadingText;
            return;
        }

        button.disabled = false;
        button.classList.remove("is-loading");

        if (button.dataset.originalHtml) {
            button.innerHTML = button.dataset.originalHtml;
            delete button.dataset.originalHtml;
        }
    }

    async function postJson(url, payload) {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(payload),
        });

        let data = {};

        try {
            data = await response.json();
        } catch (error) {
            data = {};
        }

        if (!response.ok || data.ok === false) {
            throw new Error(
                data.error || "Something went wrong. Please try again or email info@ssbgroups.in."
            );
        }

        return data;
    }

    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function getContactFieldError(input) {
        const value = String(input.value || "").trim();

        if (input.name === "name") {
            if (!value) return "Please enter your name.";
            if (value.length < 2) return "Please enter at least 2 characters.";
            if (!/[\p{L}]/u.test(value)) return "Please enter a valid name.";
            return "";
        }

        if (input.name === "email") {
            if (!value) return "Please enter your email address.";
            if (!EMAIL_RE.test(value)) return "Please enter a valid email address, like name@example.com.";
            return "";
        }

        if (input.name === "phone") {
            if (!value) return "Please enter your phone number.";
            if (!/^[+()\d\s.\-]+$/.test(value)) {
                return "Please enter a valid phone number (digits, spaces, +, -, parentheses only).";
            }
            const digits = value.replace(/\D/g, "");
            if (digits.length < 7 || digits.length > 15) {
                return "Please enter a valid phone number (7–15 digits).";
            }
            return "";
        }

        if (input.name === "message") {
            if (!value) return "Please enter your message.";
            if (value.length < 5) return "Please add a little more detail (at least 5 characters).";
            return "";
        }

        return "";
    }

    function showContactFieldError(input, message) {
        const errorElement = document.getElementById(input.id + "-error");
        const hasError = Boolean(message);

        input.classList.toggle("is-invalid", hasError);

        if (hasError) {
            input.setAttribute("aria-invalid", "true");
        } else {
            input.removeAttribute("aria-invalid");
        }

        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.toggle("is-visible", hasError);
        }
    }

    function setupContactForm() {
        const form = document.getElementById("contact-form");
        if (!form) return;

        // Use our inline messages instead of the browser's native bubbles.
        form.noValidate = true;

        const status = document.getElementById("contact-form-status");
        const button = form.querySelector('button[type="submit"]');
        const fields = Array.from(form.querySelectorAll("input[name], textarea[name]")).filter(
            (input) => input.name !== "ssb_hp" && input.name !== "website"
        );
        const touched = new Set();

        fields.forEach((input) => {
            input.addEventListener("blur", function () {
                touched.add(input.name);
                showContactFieldError(input, getContactFieldError(input));
            });

            input.addEventListener("input", function () {
                if (touched.has(input.name) || input.classList.contains("is-invalid")) {
                    showContactFieldError(input, getContactFieldError(input));
                }
            });
        });

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            let firstInvalid = null;

            fields.forEach((input) => {
                touched.add(input.name);
                const error = getContactFieldError(input);
                showContactFieldError(input, error);

                if (error && !firstInvalid) firstInvalid = input;
            });

            if (firstInvalid) {
                firstInvalid.focus();
                return;
            }

            const formData = new FormData(form);
            const payload = {
                name: formData.get("name"),
                email: formData.get("email"),
                phone: formData.get("phone"),
                message: formData.get("message"),
                ssb_hp: formData.get("ssb_hp"),
            };

            setStatus(status, "", "");
            setLoading(button, true, "Sending...");
            form.setAttribute("aria-busy", "true");

            try {
                await postJson("/api/contact", payload);

                form.reset();
                fields.forEach((input) => showContactFieldError(input, ""));
                touched.clear();
                setStatus(
                    status,
                    "success",
                    "Thank you — your message has been sent. Our team will get back to you shortly."
                );
            } catch (error) {
                setStatus(
                    status,
                    "error",
                    error.message ||
                        "We couldn't send your message right now. Please email info@ssbgroups.in."
                );
            } finally {
                setLoading(button, false);
                form.removeAttribute("aria-busy");
            }
        });
    }

    function setupSubscribeForm() {
        const form = document.getElementById("sib-form");
        if (!form) return;

        const container = document.getElementById("sib-container");
        const successPanel = document.getElementById("success-message");
        const errorPanel = document.getElementById("error-message");
        const successText = successPanel
            ? successPanel.querySelector(".sib-form-message-panel__inner-text")
            : null;
        const errorText = errorPanel
            ? errorPanel.querySelector(".sib-form-message-panel__inner-text")
            : null;
        const optinError = document.getElementById("optin-error");
        const button = form.querySelector('button[type="submit"]');

        form.addEventListener("submit", async function (event) {
            event.preventDefault();

            const emailInput = document.getElementById("EMAIL");
            const optInInput = document.getElementById("OPT_IN");
            const formData = new FormData(form);
            const email = String(formData.get("EMAIL") || "").trim();

            if (errorPanel) errorPanel.classList.remove("sib-form-message-panel--active");
            if (successPanel) successPanel.classList.remove("sib-form-message-panel--active");
            if (optinError) {
                optinError.textContent = "";
                optinError.classList.remove("is-visible");
            }

            if (!optInInput || !optInInput.checked) {
                if (optinError) {
                    optinError.textContent =
                        "Please agree to the terms and conditions to subscribe.";
                    optinError.classList.add("is-visible");
                }
                if (optInInput) optInInput.focus();
                return;
            }

            setLoading(button, true, "Subscribing...");
            form.setAttribute("aria-busy", "true");

            try {
                await postJson("/api/subscribe", {
                    email: email,
                    optIn: Boolean(optInInput && optInInput.checked),
                    ssb_hp: formData.get("ssb_hp"),
                });

                if (container) container.style.display = "none";
                if (successText) {
                    successText.textContent =
                        "Your subscription has been successful. A confirmation email is on its way to your inbox.";
                }
                if (successPanel) successPanel.classList.add("sib-form-message-panel--active");

                if (emailInput) emailInput.value = "";
                if (optInInput) optInInput.checked = false;
            } catch (error) {
                if (errorText) {
                    errorText.textContent =
                        error.message ||
                        "Your subscription could not be saved. Please try again.";
                }
                if (errorPanel) errorPanel.classList.add("sib-form-message-panel--active");
            } finally {
                setLoading(button, false);
                form.removeAttribute("aria-busy");
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            setupContactForm();
            setupSubscribeForm();
        });
    } else {
        setupContactForm();
        setupSubscribeForm();
    }
})();

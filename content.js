(function () {
  const MAX_QUESTIONS_PER_REQUEST = 10;
  const QUESTION_CONTAINER_SELECTOR = '.Qr7Oae[role="listitem"]';

  const TITLE_SELECTOR =
    ".freebirdFormviewerViewItemsItemItemTitle, .HoXoMd, .M7eMe, [role='heading']";
  const DESCRIPTION_SELECTOR = ".gubaDc, .OIC90c.RjsPE";

  function normalizeText(text = "") {
    return text
      .replace(/\s+/g, " ")
      .replace(/\s*\*\s*$/, "")
      .trim();
  }

  function getQuestionContainers() {
    const containers = Array.from(
      document.querySelectorAll(QUESTION_CONTAINER_SELECTOR)
    );

    return containers.filter((container, index) => {
      const hasTitle = container.querySelector(TITLE_SELECTOR);
      const isUnique = containers.indexOf(container) === index;
      return hasTitle && isUnique;
    });
  }

  function getQuestionTitle(container) {
    const titleEl = container.querySelector(TITLE_SELECTOR);
    const ariaLabel = container.getAttribute("aria-label");
    const fallbackFirstLine = container.innerText?.split("\n")[0];
    const text = titleEl?.textContent || ariaLabel || fallbackFirstLine || "";
    return normalizeText(text);
  }

  function getQuestionDescription(container) {
    const descEl = container.querySelector(DESCRIPTION_SELECTOR);
    return descEl ? normalizeText(descEl.textContent) : "";
  }

  function collectRoleOptions(container, role, { includeElements } = {}) {
    const nodes = Array.from(container.querySelectorAll(`[role="${role}"]`));

    return nodes
      .map((node) => {
        const labelNode =
          node.getAttribute("aria-label") ||
          node.querySelector(".aDTYNe, .ulDsOb span, .YEVVod span")
            ?.textContent ||
          node.textContent;
        const text = normalizeText(labelNode || "");
        if (!text) return null;

        const optionData = {
          text,
          isOther:
            node.getAttribute("data-value") === "__other_option__" ||
            /other[:]?$/i.test(text),
        };

        if (includeElements) {
          optionData.element =
            node.closest(".docssharedWizToggleLabeledContainer") ||
            node.closest("label") ||
            node;
        }

        return optionData;
      })
      .filter(Boolean);
  }

  function collectDropdownOptions(container, { includeElements } = {}) {
    const listBox = container.querySelector(
      '.jgvuAb[role="listbox"], .vQES8d [role="listbox"]'
    );
    if (!listBox) return [];

    return Array.from(listBox.querySelectorAll(".MocG8c[data-value]"))
      .map((optionEl) => {
        const text = normalizeText(optionEl.textContent || "");
        const value = optionEl.getAttribute("data-value") || "";
        if (!text || !value || text.toLowerCase() === "choose") return null;

        const optionData = { text, value };
        if (includeElements) {
          optionData.element = optionEl;
        }
        return optionData;
      })
      .filter(Boolean);
  }

  function collectLinearScaleOptions(container) {
    const scaleRoot = container.querySelector(".PY6Xd");
    if (!scaleRoot) return null;

    const descriptors = Array.from(scaleRoot.querySelectorAll(".g4s2gf"))
      .map((el) => normalizeText(el.textContent || ""))
      .filter(Boolean);
    const scalePoints = Array.from(
      scaleRoot.querySelectorAll("label.T5pZmf .Zki2Ve")
    )
      .map((el) => normalizeText(el.textContent || ""))
      .filter(Boolean);

    if (!scalePoints.length) return null;

    return {
      scalePoints,
      descriptors: {
        start: descriptors[0] || "",
        end: descriptors[descriptors.length - 1] || "",
      },
    };
  }

  function collectGridOptions(container) {
    const gridRoot = container.querySelector(
      '.e12QUd[jscontroller="tjSPQb"], .ObfsIf .lLfZXe.fnxRtf.EzyPc'
    );
    if (!gridRoot) return null;

    const columnHeaders = Array.from(
      gridRoot.querySelectorAll(".ssX1Bd .V4d7Ke.OIC90c")
    )
      .map((el) => normalizeText(el.textContent || ""))
      .filter(Boolean);

    const rowGroups = Array.from(
      gridRoot.querySelectorAll(".lLfZXe.fnxRtf.EzyPc, .lLfZXe.fnxRtf.cNDBpf")
    );

    const rows = rowGroups
      .map((group) => {
        const label = normalizeText(
          group.querySelector(".V4d7Ke.wzWPxe, .V4d7Ke.OIC90c")?.textContent ||
            ""
        );
        if (!label) return null;
        return {
          label,
          options: columnHeaders.map((column) => ({ column })),
        };
      })
      .filter(Boolean);

    if (!columnHeaders.length || !rows.length) return null;

    return { columns: columnHeaders, rows };
  }

  function parseQuestion(container, { includeElements } = {}) {
    const text = getQuestionTitle(container);
    if (!text) return null;

    const question = {
      text,
      description: getQuestionDescription(container),
      required: Boolean(container.querySelector(".vnumgf")),
      type: "unknown",
      options: [],
      image: container.querySelector("img")?.src || null,
      container,
    };

    const gridOptions = collectGridOptions(container);
    if (gridOptions) {
      question.type = "multipleChoiceGrid";
      question.options = gridOptions;
      return question;
    }

    const linearScaleOptions = collectLinearScaleOptions(container);
    if (linearScaleOptions) {
      question.type = "linearScale";
      question.options = linearScaleOptions;
      return question;
    }

    const dropdownOptions = collectDropdownOptions(container, {
      includeElements,
    });
    if (dropdownOptions.length) {
      question.type = "dropdown";
      question.options = dropdownOptions;
      return question;
    }

    const radioOptions = collectRoleOptions(container, "radio", {
      includeElements,
    });
    if (radioOptions.length) {
      question.type = "multipleChoice";
      question.options = radioOptions;
      return question;
    }

    const checkboxOptions = collectRoleOptions(container, "checkbox", {
      includeElements,
    });
    if (checkboxOptions.length) {
      question.type = "checkboxes";
      question.options = checkboxOptions;
      return question;
    }

    if (container.querySelector('input[type="email"]')) {
      question.type = "email";
      return question;
    }

    if (container.querySelector("textarea")) {
      question.type = "paragraph";
      return question;
    }

    if (container.querySelector('input[type="text"]')) {
      question.type = "shortAnswer";
      return question;
    }

    return question;
  }

  function extractFormContent() {
    const questionContainers = getQuestionContainers();

    console.debug(
      "Gemini Forms Helper: Candidate question containers (extractFormContent)",
      questionContainers.length
    );

    const questions = questionContainers
      .map((container) => parseQuestion(container, { includeElements: false }))
      .filter(Boolean)
      .map((question) => ({
        question: question.text,
        description: question.description,
        required: question.required,
        type: question.type,
        options: Array.isArray(question.options)
          ? question.options.map((opt) =>
              typeof opt === "string" ? opt : opt?.text || ""
            )
          : question.options,
        image: question.image,
      }));

    if (questions.length > 0) {
      console.groupCollapsed(
        "Gemini Forms Helper: Extracted questions (extractFormContent)"
      );
      questions.forEach((q, index) => {
        console.log(`Question ${index + 1}`, q);
      });
      console.groupEnd();
    } else {
      console.warn(
        "Gemini Forms Helper: No questions detected via extractFormContent."
      );
    }

    return questions;
  }

  function chunkQuestions(questions, chunkSize = MAX_QUESTIONS_PER_REQUEST) {
    const chunks = [];
    for (let i = 0; i < questions.length; i += chunkSize) {
      chunks.push({
        startIndex: i,
        questions: questions.slice(i, i + chunkSize),
      });
    }
    return chunks;
  }

  function formatQuestionForPrompt(question, questionNumber) {
    const lines = [];
    lines.push(`Question ${questionNumber}: ${question.text}`);
    lines.push(`Type: ${question.type}`);

    if (question.required) {
      lines.push("Required: yes");
    }

    if (question.description) {
      lines.push(`Description: ${question.description}`);
    }

    if (
      question.type === "multipleChoice" ||
      question.type === "checkboxes" ||
      question.type === "dropdown"
    ) {
      const optionLines = question.options.map((opt, idx) => {
        const label = opt.isOther
          ? `${opt.text} (respondent supplies text)`
          : opt.text;
        return `- Option ${idx + 1}: ${label}`;
      });
      if (optionLines.length > 0) {
        lines.push("Options:");
        lines.push(...optionLines);
      }
    } else if (question.type === "linearScale" && question.options) {
      const { scalePoints = [], descriptors = {} } = question.options;
      if (scalePoints.length > 0) {
        lines.push(`Scale points: ${scalePoints.join(", ")}`);
      }
      if (descriptors.start || descriptors.end) {
        lines.push(
          `Scale descriptors: start='${descriptors.start || ""}' end='${
            descriptors.end || ""
          }'`
        );
      }
    } else if (question.type === "multipleChoiceGrid" && question.options) {
      const { columns = [], rows = [] } = question.options;
      if (columns.length > 0) {
        lines.push(`Columns: ${columns.join(", ")}`);
      }
      if (rows.length > 0) {
        lines.push("Rows:");
        rows.forEach((row, idx) => {
          lines.push(`- Row ${idx + 1}: ${row.label}`);
        });
      }
    }

    return lines.join("\n");
  }

  function extractCourseraQuizContent() {
    // Look for question blocks in Coursera quizzes
    const questionBlocks = Array.from(
      document.querySelectorAll("[data-testid^='part-Submission_']")
    );
    const map = {};

    questionBlocks.forEach((block, index) => {
      // Extract question text from the CML viewer
      const questionElement = block.querySelector(".rc-CML .css-g2bbpm");
      if (!questionElement) return;

      const question = questionElement.textContent.trim();

      // Determine the question type
      const isNumeric =
        block.getAttribute("data-testid") === "part-Submission_NumericQuestion";
      const isMultipleChoice =
        !isNumeric && block.querySelector("[role='radiogroup']") !== null;
      const isCheckbox =
        !isNumeric &&
        !isMultipleChoice &&
        block.querySelector("[role='group']") !== null;

      if (isNumeric) {
        // For numeric questions, there are no options but we need to indicate it's a numeric type
        map[question] = ["[NUMERIC_INPUT]"];
      } else {
        // Extract options based on question type
        let options = [];

        // Multiple choice
        if (isMultipleChoice) {
          const radioOptions = block.querySelectorAll(
            "[role='radiogroup'] .rc-Option"
          );
          radioOptions.forEach((option) => {
            const optionText = option
              .querySelector(".rc-CML .css-g2bbpm")
              ?.textContent.trim();
            if (optionText) options.push(optionText);
          });
        }
        // Checkbox
        else if (isCheckbox) {
          const checkboxOptions = block.querySelectorAll(
            "[role='group'] .rc-Option"
          );
          checkboxOptions.forEach((option) => {
            const optionText = option
              .querySelector(".rc-CML .css-g2bbpm")
              ?.textContent.trim();
            if (optionText) options.push(optionText);
          });
        }

        if (options.length > 0) {
          map[question] = options;
        }
      }
    });

    if (Object.keys(map).length > 0) {
      console.groupCollapsed(
        "Gemini Forms Helper: Extracted Coursera quiz questions"
      );
      let counter = 1;
      Object.entries(map).forEach(([question, options]) => {
        console.log(`Question ${counter++}`, {
          text: question,
          options,
        });
      });
      console.groupEnd();
    } else {
      console.warn(
        "Gemini Forms Helper: No Coursera quiz questions detected on this page."
      );
    }

    return map;
  }

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "analyzeForm") {
      const formContent = extractFormContent();
      sendResponse({ success: true, content: formContent });
    } else if (request.action === "analyzeCourseraQuiz") {
      const quizContent = extractCourseraQuizContent();
      sendResponse({ success: true, content: quizContent });
    }
  });

  // Prevent the content script from being injected into the page multiple times

  // Create UI elements
  function createUI() {
    const container = document.createElement("div");
    container.className = "gemini-forms-helper";

    let iconSrc = "";
    try {
      if (chrome?.runtime?.id) {
        iconSrc = chrome.runtime.getURL("images/icon48.png");
      }
    } catch (err) {
      console.warn("Gemini Forms Helper: Unable to resolve icon path", err);
    }

    container.innerHTML = `
        <div class="gemini-forms-header">
          ${iconSrc ? `<img src="${iconSrc}" alt="Gemini Forms Helper">` : ""}
          <span>Gemini Forms Helper</span>
        </div>
        <div class="gemini-forms-status">Ready</div>
        <div class="gemini-forms-progress" style="display: none;">
          <div class="gemini-forms-progress-bar"></div>
        </div>
      `;
    document.body.appendChild(container);
    return container;
  }

  // Extract form data
  function extractFormData() {
    const formData = {
      title:
        document.querySelector(".freebirdFormviewerViewHeaderTitle, .F9yp7e")
          ?.textContent || "Google Form",
      questions: [],
    };

    const questionContainers = getQuestionContainers();

    console.debug(
      "Gemini Forms Helper: Candidate question containers (extractFormData)",
      questionContainers.length
    );

    formData.questions = questionContainers
      .map((container) => parseQuestion(container, { includeElements: true }))
      .filter(Boolean);

    if (formData.questions.length > 0) {
      console.groupCollapsed(
        "Gemini Forms Helper: Extracted Google Form questions"
      );
      formData.questions.forEach((q, idx) => {
        console.log(`Question ${idx + 1}`, {
          text: q.text,
          type: q.type,
          options: Array.isArray(q.options)
            ? q.options.map((opt) => (typeof opt === "string" ? opt : opt.text))
            : q.options,
        });
      });
      console.groupEnd();
    } else {
      console.warn(
        "Gemini Forms Helper: No questions found via extractFormData."
      );
    }

    return formData;
  }

  // Analyze form with Gemini API
  async function analyzeWithGemini(formData, apiKey, progressUpdater) {
    const endpoint =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

    const questionChunks = chunkQuestions(formData.questions);
    const totalChunks = questionChunks.length;
    const aggregatedAnswers = {};

    for (let idx = 0; idx < totalChunks; idx++) {
      if (idx > 0) {
        // Add delay between requests to avoid rate limits
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      const { startIndex, questions } = questionChunks[idx];
      const formattedQuestions = questions
        .map((question, localIdx) =>
          formatQuestionForPrompt(question, startIndex + localIdx + 1)
        )
        .join("\n\n");

      const promptSections = [
        "You are an expert assistant that answers Google Form questions accurately.",
        `Form title: "${formData.title}"`,
        "Instructions:",
        "- Use the exact question numbers provided (do not renumber).",
        "- For single-answer questions (multiple choice, dropdown, linear scale), respond with the option number, e.g. `Question 4: Option 2`.",
        "- For checkbox questions, return every correct option number separated by commas, e.g. `Question 5: Option 1, Option 3`.",
        '- For short answer, paragraph, or email responses, provide the answer wrapped in double quotes, e.g. `Question 6: "The capital is Paris"`.',
        "- For grid questions, respond with semicolon-separated row-to-column mappings, e.g. `Question 7: Row 1 -> Column 2; Row 2 -> Column 3`.",
        "- Do not include explanations, apologies, or conversational text.",
        "Example responses:",
        "Question 1: Option 2",
        "Question 2: Option 1, Option 3",
        'Question 3: "Short answer text"',
        "Question 4: Row 1 -> Column 2; Row 2 -> Column 1",
        `Here are questions ${startIndex + 1} to ${
          startIndex + questions.length
        }:`,
        formattedQuestions,
        "Provide exactly one line per question in the requested format.",
      ];

      const prompt = promptSections.join("\n");

      try {
        progressUpdater?.(
          `Analyzing questions ${startIndex + 1}-${
            startIndex + questions.length
          } (${idx + 1}/${totalChunks})...`,
          50 + Math.round(((idx + 1) / totalChunks) * 20)
        );

        console.groupCollapsed(
          `Gemini Forms Helper: Sending Gemini request (batch ${
            idx + 1
          }/${totalChunks})`
        );
        console.log("Prompt", prompt);
        console.groupEnd();

        const response = await fetch(`${endpoint}?key=${apiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.3,
              topP: 0.8,
              topK: 40,
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            `Gemini API error: ${
              errorData.error?.message || response.statusText
            }`
          );
        }

        const data = await response.json();
        console.groupCollapsed(
          `Gemini Forms Helper: Gemini API raw response (batch ${
            idx + 1
          }/${totalChunks})`
        );
        console.log("Response payload", data);
        console.groupEnd();
        const chunkAnswers = parseGeminiResponse(data);
        Object.assign(aggregatedAnswers, chunkAnswers);
      } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw error;
      }
    }

    console.groupCollapsed(
      "Gemini Forms Helper: Aggregated answers from Gemini"
    );
    console.log(aggregatedAnswers);
    console.groupEnd();

    return aggregatedAnswers;
  }

  // Parse the Gemini API response
  function parseGeminiResponse(response) {
    try {
      // Handle both gemini-pro and gemini-2.0-flash-001 response formats
      const responseText =
        response.candidates?.[0]?.content?.parts?.[0]?.text ||
        response.candidates?.[0]?.text ||
        "";

      if (!responseText) {
        throw new Error("Empty response from Gemini API");
      }

      console.groupCollapsed("Gemini Forms Helper: Gemini response text");
      console.log(responseText);
      console.groupEnd();

      const answers = {};

      // Match patterns like "Question X: [Answer]"
      const answerRegex = /Question\s+(\d+)\s*:\s*(.+?)(?=Question\s+\d+:|$)/gs;
      let match;

      while ((match = answerRegex.exec(responseText)) !== null) {
        const questionNum = parseInt(match[1], 10);
        const answerText = match[2].trim();
        answers[questionNum] = answerText;
      }

      return answers;
    } catch (error) {
      console.error("Error parsing Gemini response:", error);
      throw new Error("Could not parse Gemini response");
    }
  }

  // Fill in the form with the answers
  function fillFormWithAnswers(formData, answers) {
    console.groupCollapsed("Gemini Forms Helper: Applying answers to form");
    console.log("Answers", answers);
    console.groupEnd();

    formData.questions.forEach((question, index) => {
      const questionNum = index + 1;
      const answer = answers[questionNum];

      if (!answer) return;

      if (question.type === "multipleChoice") {
        // For multiple choice, find the option mentioned in the answer
        const optionMatch = answer.match(/Option\s+(\d+)/i);
        if (optionMatch) {
          const optionNum = parseInt(optionMatch[1], 10) - 1;
          if (question.options[optionNum]) {
            const optionElement = question.options[optionNum].element;

            // Try different ways to click the option
            const input = optionElement.querySelector("input, .Od2TWd");
            if (input) {
              input.click();
              highlightAnswer(optionElement);
            } else {
              // If no input found, try clicking the element itself
              optionElement.click();
              highlightAnswer(optionElement);
            }

            // Log the selection for verification
            console.log(
              `Selected option ${optionNum + 1} for question ${questionNum}: ${
                question.text
              }`
            );
          }
        }
      } else if (question.type === "checkboxes") {
        // For checkboxes, there might be multiple options
        const optionMatches = answer.match(/Option\s+(\d+)/gi) || [];
        optionMatches.forEach((optMatch) => {
          const optionNum =
            parseInt(optMatch.replace(/Option\s+/i, ""), 10) - 1;
          if (question.options[optionNum]) {
            const optionElement = question.options[optionNum].element;

            // Try different ways to click the checkbox
            const input = optionElement.querySelector("input, .Od2TWd");
            if (input) {
              input.click();
              highlightAnswer(optionElement);
            } else {
              // If no input found, try clicking the element itself
              optionElement.click();
              highlightAnswer(optionElement);
            }

            // Log the selection for verification
            console.log(
              `Selected checkbox option ${
                optionNum + 1
              } for question ${questionNum}: ${question.text}`
            );
          }
        });
      } else if (
        question.type === "shortAnswer" ||
        question.type === "paragraph"
      ) {
        // For text inputs
        const input = question.container.querySelector(
          'input[type="text"], textarea'
        );
        if (input) {
          input.value = answer;
          // Trigger input event to update form state
          const event = new Event("input", { bubbles: true });
          input.dispatchEvent(event);
          highlightAnswer(input);

          // Log the input for verification
          console.log(
            `Entered text for question ${questionNum}: ${question.text}`
          );
        }
      }
    });

    // Scroll through the form to make selections visible
    window.scrollTo(0, 0);
    setTimeout(() => {
      window.scrollTo(0, document.body.scrollHeight);
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 500);
    }, 500);
  }

  // Highlight a Coursera answer option
  function highlightCourseraAnswer(element, type = "radio") {
    const highlightTarget =
      element.closest("label") || element.closest(".rc-Option") || element;

    console.log("Gemini Forms Helper: Highlighting Coursera answer", {
      type,
      label: highlightTarget.innerText?.trim?.(),
    });

    if (!highlightTarget) return;

    highlightTarget.style.position = "relative";
    highlightTarget.classList.add("gemini-answer-highlight");

    highlightTarget
      .querySelectorAll(".gemini-answer-indicator")
      .forEach((node) => node.remove());

    // Remove previous full highlighting
    highlightTarget.style.borderLeft = "";
    highlightTarget.style.backgroundColor = "";
    highlightTarget.style.borderRadius = "";

    // Add a small checkmark at the end of the option
    const indicator = document.createElement("div");
    indicator.textContent = "✓";
    indicator.style.position = "absolute";
    indicator.style.right = "10px";
    indicator.style.top = "50%";
    indicator.style.transform = "translateY(-50%)";
    indicator.style.fontSize = "16px";
    indicator.style.fontWeight = "bold";
    indicator.style.color = "#7209b7";

    // Only add the indicator if it doesn't already exist
    indicator.classList.add("gemini-answer-indicator");
    highlightTarget.appendChild(indicator);

    // Scroll to make the element visible
    highlightTarget.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Highlight answer in Google Forms
  function highlightAnswer(element) {
    const highlightTarget =
      element.closest(
        ".docssharedWizToggleLabeledContainer, .freebirdFormviewerViewItemsItemItem, .Qr7Oae[role='listitem']"
      ) || element;

    console.log("Gemini Forms Helper: Highlighting Google Form answer", {
      label: highlightTarget.innerText?.trim?.(),
    });

    if (highlightTarget.classList.contains("gemini-answer-highlight")) {
      highlightTarget
        .querySelectorAll(".gemini-answer-indicator")
        .forEach((node) => node.remove());
    }

    highlightTarget.classList.add("gemini-answer-highlight");

    // Add a checkmark indicator
    const indicator = document.createElement("div");
    indicator.style.position = "absolute";
    indicator.style.right = "10px";
    indicator.style.top = "50%";
    indicator.style.transform = "translateY(-50%)";
    indicator.style.fontSize = "14px";
    indicator.style.fontWeight = "bold";
    indicator.style.color = "#2e7d32";
    indicator.innerHTML = "✓";
    indicator.style.zIndex = "2";
    indicator.style.pointerEvents = "none";
    // A random Comment
    indicator.classList.add("gemini-answer-indicator");

    // Make sure the element can position the indicator
    if (getComputedStyle(highlightTarget).position === "static") {
      highlightTarget.style.position = "relative";
    }

    highlightTarget
      .querySelectorAll(".gemini-answer-indicator")
      .forEach((node) => node.remove());

    // Add the indicator to the element
    highlightTarget.appendChild(indicator);

    // Scroll the element into view to make it visible
    highlightTarget.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Update UI status
  function updateUIStatus(container, status, isError = false) {
    const statusElement = container.querySelector(".gemini-forms-status");
    if (statusElement) {
      statusElement.textContent = status;
      statusElement.style.color = isError ? "#c62828" : "#2e7d32";
    }
  }

  // Handle progress updates
  function updateProgress(container, percent) {
    const progressContainer = container.querySelector(".gemini-forms-progress");
    const progressBar = container.querySelector(".gemini-forms-progress-bar");

    if (progressContainer && progressBar) {
      progressContainer.style.display = percent >= 0 ? "block" : "none";
      progressBar.style.width = `${percent}%`;
    }
  }

  // Main process function
  async function processForm(apiKey) {
    const uiContainer = createUI();

    try {
      updateUIStatus(uiContainer, "Extracting form data...");
      updateProgress(uiContainer, 20);
      const formData = extractFormData();

      updateUIStatus(uiContainer, "Analyzing with Gemini...");
      updateProgress(uiContainer, 45);
      const answers = await analyzeWithGemini(
        formData,
        apiKey,
        (status, percent) => {
          if (status) {
            updateUIStatus(uiContainer, status);
          }
          if (typeof percent === "number") {
            updateProgress(uiContainer, percent);
          }
        }
      );

      updateUIStatus(uiContainer, "Filling in answers...");
      updateProgress(uiContainer, 80);
      fillFormWithAnswers(formData, answers);

      updateUIStatus(uiContainer, "Complete! Answers marked.");
      updateProgress(uiContainer, 100);

      // Remove UI after 5 seconds
      setTimeout(() => {
        uiContainer.style.opacity = "0";
        setTimeout(() => uiContainer.remove(), 500);
      }, 5000);

      return { success: true };
    } catch (error) {
      updateUIStatus(uiContainer, `Error: ${error.message}`, true);
      updateProgress(uiContainer, -1);
      console.error("Form processing error:", error);
      return { success: false, error: error.message };
    }
  }

  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "analyzeForm") {
      processForm(message.apiKey)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Indicates async response
    } else if (message.action === "processCourseraAnswers") {
      processCourseraAnswers(message.answers)
        .then(sendResponse)
        .catch((error) =>
          sendResponse({ success: false, error: error.message })
        );
      return true; // Indicates async response
    }
  });

  // Process and highlight Coursera quiz answers
  async function processCourseraAnswers(answers) {
    // Create UI container for status
    const uiContainer = createUI();
    updateUIStatus(uiContainer, "Highlighting answers...");
    updateProgress(uiContainer, 20);

    try {
      // Get all question blocks
      const questionBlocks = Array.from(
        document.querySelectorAll("[data-testid^='part-Submission_']")
      );
      let highlightCount = 0;

      // Process each question
      for (let i = 0; i < questionBlocks.length; i++) {
        const block = questionBlocks[i];
        const questionText = block
          .querySelector(".rc-CML .css-g2bbpm")
          ?.textContent.trim();

        if (!questionText) continue;

        // Find the answer for this question (by question number or matching text)
        const questionNum = i + 1;
        const answer = answers[questionNum];

        if (!answer) continue;

        // Determine question type
        const isNumeric =
          block.getAttribute("data-testid") ===
          "part-Submission_NumericQuestion";
        const isMultipleChoice =
          !isNumeric && block.querySelector("[role='radiogroup']") !== null;
        const isCheckbox =
          !isNumeric &&
          !isMultipleChoice &&
          block.querySelector("[role='group']") !== null;

        console.log(
          `Question ${questionNum}: Type = ${
            isNumeric
              ? "numeric"
              : isMultipleChoice
              ? "multiple choice"
              : isCheckbox
              ? "checkbox"
              : "unknown"
          }, Answer = ${answer}`
        );

        if (isNumeric) {
          // Handle numeric input questions
          const input = block.querySelector("input[type='number']");
          if (input) {
            try {
              // Extract the numeric value from the answer text
              const numericValue = answer.replace(/[^0-9]/g, "");

              // Set the input value
              input.value = numericValue;

              // Trigger input event to update form state
              const event = new Event("input", { bubbles: true });
              input.dispatchEvent(event);

              // Add visual indicator that this has been filled
              const inputContainer =
                input.closest("._kxlijz") || input.parentElement;
              if (inputContainer) {
                inputContainer.style.position = "relative";
                inputContainer.style.borderLeft = "4px solid #7209b7";

                // Add a checkmark indicator
                const indicator = document.createElement("div");
                indicator.textContent = "✓";
                indicator.style.position = "absolute";
                indicator.style.right = "10px";
                indicator.style.top = "50%";
                indicator.style.transform = "translateY(-50%)";
                indicator.style.fontSize = "16px";
                indicator.style.fontWeight = "bold";
                indicator.style.color = "#7209b7";
                indicator.style.zIndex = "10";
                indicator.classList.add("gemini-answer-indicator");

                if (!inputContainer.querySelector(".gemini-answer-indicator")) {
                  inputContainer.appendChild(indicator);
                }
              }

              highlightCount++;
              console.log(`Filled numeric input with value: ${numericValue}`);
            } catch (e) {
              console.log("Couldn't set numeric input value:", e);
            }
          }
        } else if (isMultipleChoice) {
          // Handle multiple choice questions - existing code
          const optionMatch = answer.match(/Option\s+(\d+)/i);
          if (optionMatch) {
            const optionNum = parseInt(optionMatch[1], 10) - 1;
            const options = Array.from(
              block.querySelectorAll("[role='radiogroup'] .rc-Option")
            );

            if (options[optionNum]) {
              const optionElement = options[optionNum];

              // Try to actually click the radio button
              const input = optionElement.querySelector("input[type='radio']");
              if (input) {
                try {
                  input.click();
                  console.log(
                    `Clicked radio button for option ${optionNum + 1}`
                  );
                } catch (e) {
                  console.log("Couldn't click radio button:", e);
                }
              }

              // Highlight the option
              const label = optionElement.querySelector("label");
              if (label) {
                highlightCourseraAnswer(label, "radio");
                highlightCount++;
              }
            }
          }
        } else if (isCheckbox) {
          // Handle checkbox questions - existing code
          const optionMatches = answer.match(/Option\s+(\d+)/gi) || [];
          console.log(
            `Found ${optionMatches.length} options in answer for question ${questionNum}:`,
            answer
          );

          for (const optMatch of optionMatches) {
            const optionNum =
              parseInt(optMatch.replace(/Option\s+/i, ""), 10) - 1;
            const options = Array.from(
              block.querySelectorAll("[role='group'] .rc-Option")
            );
            console.log(
              `Processing option ${optionNum + 1} of ${
                options.length
              } available options`
            );

            if (options[optionNum]) {
              const optionElement = options[optionNum];

              // Try to actually click the checkbox
              const input = optionElement.querySelector(
                "input[type='checkbox']"
              );
              if (input) {
                try {
                  input.click();
                  console.log(`Clicked checkbox for option ${optionNum + 1}`);
                } catch (e) {
                  console.log("Couldn't click checkbox:", e);
                }
              }

              // Highlight the option
              const label = optionElement.querySelector("label");
              if (label) {
                highlightCourseraAnswer(label, "checkbox");
                highlightCount++;
              }
            }
          }
        }
      }

      updateUIStatus(
        uiContainer,
        `Complete! Highlighted ${highlightCount} answers.`
      );
      updateProgress(uiContainer, 100);

      // Remove UI after 5 seconds
      setTimeout(() => {
        uiContainer.style.opacity = "0";
        setTimeout(() => uiContainer.remove(), 500);
      }, 5000);

      return { success: true, highlightCount };
    } catch (error) {
      updateUIStatus(uiContainer, `Error: ${error.message}`, true);
      updateProgress(uiContainer, -1);
      console.error("Error processing Coursera answers:", error);
      return { success: false, error: error.message };
    }
  }
})();

import {
	App,
	FuzzySuggestModal,
	Modal,
	Notice,
	Setting,
	TFile,
} from "obsidian";
import type {FulcrumHost} from "./pluginBridge";
import type {IndexedProject} from "./types";

export class ProjectPickerModal extends FuzzySuggestModal<IndexedProject> {
	private readonly projects: IndexedProject[];
	private readonly onPick: (p: IndexedProject) => void;

	constructor(app: App, projects: IndexedProject[], onPick: (p: IndexedProject) => void) {
		super(app);
		this.projects = projects;
		this.onPick = onPick;
	}

	getItems(): IndexedProject[] {
		return this.projects;
	}

	getItemText(item: IndexedProject): string {
		return item.name;
	}

	onChooseItem(item: IndexedProject, _evt: MouseEvent | KeyboardEvent): void {
		this.onPick(item);
	}
}

export class NewProjectModal extends Modal {
	private name = "";
	private areaPath: string | null = null;
	private readonly host: FulcrumHost;

	constructor(app: App, host: FulcrumHost) {
		super(app);
		this.host = host;
	}

	onOpen(): void {
		const {contentEl} = this;
		contentEl.empty();
		contentEl.createEl("h2", {text: "New project"});

		new Setting(contentEl)
			.setName("Name")
			.setDesc("Creates a note under your areas & projects folder.")
			.addText((t) =>
				t.onChange((v) => {
					this.name = v;
				}),
			);

		const areas = this.host.vaultIndex.getSnapshot().areas;
		if (areas.length > 0) {
			new Setting(contentEl).setName("Area").addDropdown((d) => {
				d.addOption("", "(none)");
				for (const a of areas) {
					d.addOption(a.file.path, a.name);
				}
				d.onChange((v) => {
					this.areaPath = v || null;
				});
			});
		}

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText("Create")
				.setCta()
				.onClick(() => {
					void this.create();
				}),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async create(): Promise<void> {
		const name = this.name.trim();
		if (!name) {
			new Notice("Enter a project name.");
			return;
		}
		const s = this.host.settings;
		const base = s.areasProjectsFolder.replace(/\/+$/, "");
		const path = `${base}/${name}.md`;
		if (this.app.vault.getAbstractFileByPath(path)) {
			new Notice("A note already exists at that path.");
			return;
		}

		let areaLink = "";
		if (this.areaPath) {
			const f = this.app.vault.getAbstractFileByPath(this.areaPath);
			if (f instanceof TFile) {
				const bn = f.basename.replace(/\.md$/i, "");
				areaLink = `[[${bn}]]`;
			}
		}

		const lines: string[] = [
			"---",
			`${s.typeField}: ${s.projectTypeValue}`,
			`name: ${JSON.stringify(name)}`,
		];
		if (areaLink) {
			lines.push(`${s.areaLinkField}: ${JSON.stringify(areaLink)}`);
		}
		lines.push("status: planning", `${s.taskPriorityField}: medium`, "---", "", `# ${name}`, "");

		const body = lines.join("\n");
		try {
			await this.app.vault.create(path, body);
			new Notice(`Created ${path}`);
			await this.host.vaultIndex.rebuild();
			await this.host.openProjectSummary(path);
			this.close();
		} catch (e) {
			console.error(e);
			new Notice("Could not create project note.");
		}
	}
}

export class LinkMeetingModal extends FuzzySuggestModal<IndexedProject> {
	private readonly file: TFile;
	private readonly host: FulcrumHost;

	constructor(app: App, host: FulcrumHost, file: TFile) {
		super(app);
		this.host = host;
		this.file = file;
	}

	getItems(): IndexedProject[] {
		return this.host.vaultIndex.getSnapshot().projects;
	}

	getItemText(item: IndexedProject): string {
		return item.name;
	}

	onChooseItem(item: IndexedProject, _evt: MouseEvent | KeyboardEvent): void {
		void this.applyMeetingLink(item);
	}

	private async applyMeetingLink(item: IndexedProject): Promise<void> {
		const s = this.host.settings;
		const bn = item.file.basename.replace(/\.md$/i, "");
		const value = `[[${bn}]]`;
		try {
			await this.app.fileManager.processFrontMatter(this.file, (fm) => {
				(fm as Record<string, unknown>)[s.projectLinkField] = value;
			});
			new Notice(`Linked meeting to ${item.name}`);
			await this.host.vaultIndex.rebuild();
		} catch (e) {
			console.error(e);
			new Notice("Could not update frontmatter.");
		} finally {
			this.close();
		}
	}
}

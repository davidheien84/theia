/********************************************************************************
 * Copyright (C) 2018 TypeFox and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

import { inject, injectable, postConstruct } from "inversify";
import { VirtualWidget, VirtualRenderer, Message } from "@theia/core/lib/browser";
import { VirtualElement, h } from "@phosphor/virtualdom";
import { OutputChannelManager, OutputChannel } from "../common/output-channel";

import "../../src/browser/style/output.css";

export const OUTPUT_WIDGET_KIND = 'outputView';

@injectable()
export class OutputWidget extends VirtualWidget {

    protected selectedChannel: OutputChannel | undefined;

    @inject(OutputChannelManager)
    protected readonly outputChannelManager: OutputChannelManager;

    constructor() {
        super();
        this.id = OUTPUT_WIDGET_KIND;
        this.title.label = 'Output';
        this.title.iconClass = 'fa fa-flag';
        this.title.closable = true;
        this.addClass('theia-output');
    }

    @postConstruct()
    protected init(): void {
        this.outputChannelManager.getChannels().forEach(this.registerListener.bind(this));
        this.toDispose.push(this.outputChannelManager.onChannelAdded(channel => {
            this.registerListener(channel);
            this.update();
        }));
        this.toDispose.push(this.outputChannelManager.onChannelDelete(event => {
            if (this.selectedChannel && this.selectedChannel.name === event.channelName) {
                this.selectedChannel = this.getVisibleChannels()[0];
            }
            this.update();
        }));
        this.update();
    }

    protected onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        const channelSelector = document.getElementById('outputChannelList');
        if (channelSelector) {
            channelSelector.focus();
        } else {
            this.node.focus();
        }
    }

    protected registerListener(outputChannel: OutputChannel): void {
        if (!this.selectedChannel) {
            this.selectedChannel = outputChannel;
        }
        this.toDispose.push(outputChannel.onContentChange(c => {
            if (outputChannel === this.selectedChannel) {
                this.update();
            }
        }));
        this.toDispose.push(outputChannel.onVisibilityChange(event => {
            if (event.visible) {
                this.selectedChannel = outputChannel;
            } else if (outputChannel === this.selectedChannel) {
                this.selectedChannel = this.getVisibleChannels()[0];
            }
            this.update();
        }));
    }

    render(): VirtualElement[] {
        return [this.renderChannelSelector(), this.renderChannelContents()];
    }

    private readonly OUTPUT_CONTENTS_ID = 'outputContents';

    protected renderChannelContents(): VirtualElement {
        if (this.selectedChannel) {
            return h.div(
                { id: this.OUTPUT_CONTENTS_ID },
                VirtualRenderer.flatten(this.selectedChannel.getLines().map(line => this.toHtmlText(line))));
        } else {
            return h.div({ id: this.OUTPUT_CONTENTS_ID });
        }
    }

    protected toHtmlText(text: string): VirtualElement[] {
        const result: VirtualElement[] = [];
        if (text) {
            const lines = text.split(/([\n\r]+)/);
            for (const line of lines) {
                result.push(h.div(line));
            }
        } else {
            result.push(h.div('<no output yet>'));
        }
        return result;
    }

    private readonly NONE = '<no channels>';

    protected renderChannelSelector(): VirtualElement {
        const channelOptionElements: h.Child[] = [];
        this.getVisibleChannels().forEach(channel => {
            const attrs: {value: string; selected?: string} = {value: channel.name};
            if (channel === this.selectedChannel) {
                attrs.selected = 'selected';
            }
            channelOptionElements.push(h.option(attrs, channel.name));
        });
        if (channelOptionElements.length === 0) {
            channelOptionElements.push(h.option({ value: this.NONE }, this.NONE));
        }
        return h.select({
            id: 'outputChannelList',
            onchange: async event => {
                const channelName = (event.target as HTMLSelectElement).value;
                if (channelName !== this.NONE) {
                    this.selectedChannel = this.outputChannelManager.getChannel(channelName);
                    this.update();
                }
            }
        }, VirtualRenderer.flatten(channelOptionElements));
    }

    protected onUpdateRequest(msg: Message): void {
        super.onUpdateRequest(msg);
        setTimeout(() => {
            const div = document.getElementById(this.OUTPUT_CONTENTS_ID) as HTMLDivElement;
            if (div && div.children.length > 0) {
                div.children[div.children.length - 1].scrollIntoView(false);
            }
        });
    }

    protected getVisibleChannels(): OutputChannel[] {
        return this.outputChannelManager.getChannels().filter(channel => channel.isVisible);
    }
}

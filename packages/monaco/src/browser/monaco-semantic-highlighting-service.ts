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

import { inject, injectable } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { ILogger } from '@theia/core/lib/common/logger';
import { TextEditor } from '@theia/editor/lib/browser/editor';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { EditorDecoration, EditorDecorationOptions } from '@theia/editor/lib/browser/decorations';
import { Disposable, DisposableCollection } from '@theia/core/lib/common/disposable';
import { SemanticHighlightingService, SemanticHighlightingRange, Range } from '@theia/editor/lib/browser/semantic-highlight/semantic-highlighting-service';
import { MonacoEditor } from './monaco-editor';
import StaticServices = monaco.services.StaticServices;
import Color = monaco.services.Color;
import TokenMetadata = monaco.modes.TokenMetadata;

@injectable()
export class MonacoSemanticHighlightingService implements SemanticHighlightingService {

    @inject(ILogger)
    protected readonly logger: ILogger;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    protected readonly toDisposeOnEditorClose = new Map<string, Disposable>();
    protected readonly decorations = new Map<string, DecorationWithRanges>();
    protected readonly colorMapCache = new Map<string, string>();

    async decorate(uri: URI, ranges: SemanticHighlightingRange[]): Promise<void> {
        const editorWidget = await this.editorManager.getByUri(uri);
        if (!editorWidget) {
            return;
        }
        if (!(editorWidget.editor instanceof MonacoEditor)) {
            return;
        }

        const editor = editorWidget.editor;
        const key = uri.toString();
        if (!this.toDisposeOnEditorClose.has(key)) {
            this.toDisposeOnEditorClose.set(key, new DisposableCollection([
                editor.onDispose((() => this.deleteDecorations(key, editor))),
                Disposable.create(() => this.toDisposeOnEditorClose.delete(key))
            ]));
        }

        // Merge the previous state with the current one. Collect all affected lines based on the new state.
        const affectedLines = new Set(ranges.map(r => r.start.line));
        const oldState = this.decorations.get(key) || DecorationWithRanges.EMPTY;
        // Discard all ranges from the previous state that are from an affected line from the new state.
        // And merge them with the ranges from the new state. We cache them together.
        const rangesToCache = oldState.ranges.filter(r => !affectedLines.has(r.start.line)).concat(ranges);
        // XXX: Why cannot TS infer this type? Perhaps `EditorDecorationOptions` has only optional properties. Just guessing though.
        const newDecorations: EditorDecoration[] = rangesToCache.map(this.toDecoration.bind(this));
        const oldDecorations = oldState.decorations;
        // Do the decorations.
        const newState = editor.deltaDecorations({
            newDecorations,
            oldDecorations
        });

        // Cache the new state.
        this.decorations.set(key, {
            ranges: rangesToCache,
            decorations: newState
        });
    }

    dispose(): void {
        Array.from(this.toDisposeOnEditorClose.values()).forEach(disposable => disposable.dispose());
    }

    protected async deleteDecorations(uri: string, editor: TextEditor): Promise<void> {
        const decorationWithRanges = this.decorations.get(uri);
        if (decorationWithRanges) {
            const oldDecorations = decorationWithRanges.decorations;
            editor.deltaDecorations({
                newDecorations: [],
                oldDecorations
            });
            this.decorations.delete(uri);
        }
    }

    protected toDecoration(range: SemanticHighlightingRange): EditorDecoration {
        // const { start, end } = range;
        // XXX: This is a hack to be able to see the decorations.
        const start = {
            line: range.start.line,
            character: range.start.character + 2
        };
        const end = {
            line: range.end.line,
            character: range.end.character + 2
        };
        const options = this.toOptions(range.scopes);
        return {
            range: Range.create(start, end),
            options
        };
    }

    protected toOptions(scopes: string[]): EditorDecorationOptions {
        // TODO: why for-of? How to pick the right scope? Is it fine to get the first element (with the narrowest scope)?
        for (const scope of scopes) {
            const { metadata } = this.tokenTheme()._match(scope);
            // TODO: enable some sort of caching.
            // const colorMap: string[] = this.colorMap().map(this.toColorString.bind(this));
            const inlineClassName = TokenMetadata.getClassNameFromMetadata(metadata);
            return {
                inlineClassName
            };
        }
        return {};
    }

    protected toColorString(color: Color): string {
        // TODO: get rid of this and the color cache map and other obsolete code (including the index.d.ts) if not needed.
        const { r, g, b } = color.rgba;
        return `#${[r, g, b].map(c => c.toString(16)).map(c => c.length < 2 ? `0${c}` : c).join('')}`;
    }

    protected colorMapIndex(...scopes: string[]) {
        scopes.map(scope => {
            const themeTrie = this.tokenTheme()._match(scope);
            const foreground = TokenMetadata.getForeground(themeTrie.metadata);
            const background = TokenMetadata.getBackground(themeTrie.metadata);
            console.log(`scope: ${scope} => ${themeTrie} => ${foreground}:${background}`);
        });
    }

    protected colorMap(): monaco.services.Color[] {
        return this.tokenTheme().getColorMap();
    }

    protected tokenTheme(): monaco.services.TokenTheme {
        return StaticServices.standaloneThemeService.get().getTheme().tokenTheme;
    }

}

/**
 * Helper tuple type with text editor decoration IDs and the raw highlighting ranges.
 */
export interface DecorationWithRanges {
    readonly decorations: string[];
    readonly ranges: SemanticHighlightingRange[];
}

export namespace DecorationWithRanges {
    export const EMPTY: DecorationWithRanges = {
        decorations: [],
        ranges: []
    };
}

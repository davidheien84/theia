/********************************************************************************
 * Copyright (C) 2018 TypeFox, Ericsson and others.
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

import { ContainerModule } from "inversify";
import { LanguageGrammarDefinitionContribution } from "@theia/monaco/lib/browser/textmate";
import { LanguageClientContribution } from "@theia/languages/lib/browser";
import { CallHierarchyService } from "@theia/callhierarchy/lib/browser";
import { TypeScriptClientContribution, JavaScriptClientContribution } from "./typescript-client-contribution";
import { TypeScriptCallHierarchyService } from "./typescript-callhierarchy-service";
import { TypescriptGrammarContribution } from "./typescript-language-config";
import { JavascriptGrammarContribution } from "./javascript-language-config";

export default new ContainerModule(bind => {
    bind(TypeScriptClientContribution).toSelf().inSingletonScope();
    bind(LanguageClientContribution).toService(TypeScriptClientContribution);

    bind(JavaScriptClientContribution).toSelf().inSingletonScope();
    bind(LanguageClientContribution).toService(JavaScriptClientContribution);

    bind(TypeScriptCallHierarchyService).toSelf().inSingletonScope();
    bind(CallHierarchyService).toService(TypeScriptCallHierarchyService);

    bind(LanguageGrammarDefinitionContribution).to(TypescriptGrammarContribution).inSingletonScope();
    bind(LanguageGrammarDefinitionContribution).to(JavascriptGrammarContribution).inSingletonScope();
});

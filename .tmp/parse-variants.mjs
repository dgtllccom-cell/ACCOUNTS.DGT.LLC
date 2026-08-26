import fs from 'fs';
import * as acorn from 'acorn';
import jsx from 'acorn-jsx';

const Parser = acorn.Parser.extend(jsx());
const file = 'features/purchases/components/purchase-order-wizard.jsx';
const src = fs.readFileSync(file, 'utf8');

function parse(name, text) {
  try {
    Parser.parse(text, { sourceType: 'module', ecmaVersion: 'latest' });
    console.log(name, 'OK');
  } catch (e) {
    console.log(name, 'ERR', e.message, '@', e.loc);
  }
}

const endKeep = src;
const end1 = src.replace(/\n\s*<\/main>\n\s*<\/div>\n\s*\);\n\s*}\s*$/, '\n    </main>\n    </div>\n  );\n}');
const end2 = src.replace(/\n\s*<\/main>\n\s*<\/div>\n\s*\);\n\s*}\s*$/, '\n    </main>\n    </div>\n    </div>\n  );\n}');
const beforePreview1 = src.replace(/\n\s*\{previewModalOpen && \(/, '\n    </main>\n      </div>\n\n      {previewModalOpen && (').replace(/\n\s*<\/main>\n\s*<\/div>\n\s*\);\n\s*}\s*$/, '\n    </div>\n  );\n}');
const beforePreview2 = src.replace(/\n\s*\{previewModalOpen && \(/, '\n    </main>\n      </div>\n\n      {previewModalOpen && (').replace(/\n\s*<\/main>\n\s*<\/div>\n\s*\);\n\s*}\s*$/, '\n    </div>\n    </div>\n  );\n}');
const beforePreview3 = src.replace(/\n\s*\{previewModalOpen && \(/, '\n    </main>\n      </div>\n\n      {previewModalOpen && (').replace(/\n\s*<\/main>\n\s*<\/div>\n\s*\);\n\s*}\s*$/, '\n    </div>\n    </div>\n    </div>\n  );\n}');

for (const [name, text] of Object.entries({ endKeep, end1, end2, beforePreview1, beforePreview2, beforePreview3 })) {
  parse(name, text);
}

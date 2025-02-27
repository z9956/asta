import { parse } from './parse.mjs'
const whitespaceRE = /^\s+$/;

const textSpecialRE = /(^|[^\\])("|\n)/g;

let functionType = 'h';

function generateName(nameTree) {
    const name = generate(nameTree);
    return `${functionType}('${name}',`
}

function generate(tree) {
    const type = tree.type;

    if (typeof tree === "string") {
        return tree;
    } else if (Array.isArray(tree)) {
        let output = "";

        for (let i = 0; i < tree.length; i++) {
            output += generate(tree[i]);
        }

        return output;
    } else if (type === "comment") {
        return `/*${generate(tree.value[1])}*/`;
    } else if (type === "attributes") {
        const value = tree.value;
        let output = "";
        let separator = "";

        for (let i = 0; i < value.length; i++) {
            const pair = value[i];
            output += `${separator}"${generate(pair[0])}":${generate(pair[2])}${generate(pair[3])}`;
            separator = ",";
        }

        return {
            output,
            separator
        };
    } else if (type === "text") {
        const textGenerated = generate(tree.value);
        const textGeneratedIsWhitespace = whitespaceRE.test(textGenerated) && textGenerated.indexOf("\n") !== -1;
        return {
            output: textGeneratedIsWhitespace ?
                textGenerated :
                `"${textGenerated.replace(textSpecialRE, (match, character, characterSpecial) =>
                    character + (characterSpecial === "\"" ? "\\\"" : "\\n\\\n")
                )
                }"`,
            isWhitespace: textGeneratedIsWhitespace
        };
    } else if (type === "interpolation") {
        return `${generate(tree.value[1])}`;
    } else if (type === "node") {
        const value = tree.value;
        return generate(value[1]) + generateName(value[2]) + generate(value[3]);
    } else if (type === "nodeData") {
        const value = tree.value;
        const data = value[4];
        const dataGenerated = generate(data);

        return `${generate(value[1])}${generateName(value[2])}${generate(value[3])}(${data.type === "attributes" ? `{${dataGenerated.output}}` : dataGenerated
            })`;
    } else if (type === "nodeDataChildren") {
        const value = tree.value;
        const data = generate(value[4]);
        const children = value[6];
        const childrenLength = children.length;
        let childrenGenerated;

        if (childrenLength === 0) {
            childrenGenerated = "";
        } else {
            let separator = "";
            childrenGenerated = data.separator + "children:[";

            for (let i = 0; i < childrenLength; i++) {
                const child = children[i];
                const childGenerated = generate(child);

                if (child.type === "text") {
                    if (childGenerated.isWhitespace) {
                        childrenGenerated += childGenerated.output;
                    } else {
                        childrenGenerated += separator + childGenerated.output;
                        separator = ",";
                    }
                } else {
                    childrenGenerated += separator + childGenerated;
                    separator = ",";
                }
            }

            childrenGenerated += "]";
        }
        return `${generate(value[1])}${generateName(value[2])}${generate(value[3])}{${data.output}${childrenGenerated}})`;
    }
}

function compile(input) {
    const { ast } = parse(input);
    if (process.env.MOON_ENV === "development" && ast.constructor.name === "ParseError") {
        error(`Invalid input to parser.
Attempted to parse input.
Expected ${ast.expected}.
Received:
${format(input, ast.index)}`);
    }
    return generate(ast[0][0]);
}

export { generate, compile }
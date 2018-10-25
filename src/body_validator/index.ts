interface Construcable<P> {
    new(...arg: any[]): P;
}

type ObjectOfAll = { [key: string]: All };
interface ArrayOfAll extends Array<All> { }

export type All =
    AbstractMatcher<any> |
    StringConstructor |
    BooleanConstructor |
    NumberConstructor |
    ArrayOfAll |
    ObjectOfAll |
    Construcable<any> |
    string |
    number |
    boolean |
    symbol |
    null |
    undefined;


type UnWrapObj<T extends All> = {
    [P in keyof T]: Unwrap<T[P] extends All ? T[P] : null>;
};

interface UnwrapArrayOf<T extends All> extends Array<Unwrap<T>> { }

export type Unwrap<T extends All> =
    T extends AbstractMatcher<infer U> ? U :
    T extends StringConstructor ? string :
    T extends BooleanConstructor ? boolean :
    T extends NumberConstructor ? number :
    T extends Array<infer V> ? UnwrapArrayOf<V extends All ? V : null> :
    T extends { [key: string]: All } ? UnWrapObj<T> : |
    T extends Construcable<infer W> ? W :
    T;

export abstract class AbstractMatcher<T> {
    public abstract matchLoose(arg: any): boolean;
    public abstract match(arg: any): arg is T;
    public abstract convert(arg: any): T;
}

export class StringMatcher extends AbstractMatcher<string> {
    public matchLoose(arg: any) {
        return arg != null;
    }

    public match(arg: any): arg is string {
        return typeof arg === "string";
    }

    public convert(arg: any) {
        if (!this.matchLoose(arg)) {
            throw new TypeError(`cannot convert ${arg} to string`);
        }

        return "" + arg;
    }
}

export class BooleanMatcher extends AbstractMatcher<boolean> {
    public matchLoose(arg: any) {
        return typeof arg === "boolean" || arg === "true" || arg === "false";
    }

    public match(arg: any): arg is boolean {
        return typeof arg === "boolean";
    }

    public convert(arg: any) {
        if (!this.matchLoose(arg)) {
            throw new TypeError(`cannot convert ${arg} to boolean`);
        }

        return typeof arg === "string" ? arg === "true" : arg;
    }
}

export class NumberMatcher extends AbstractMatcher<number> {
    public matchLoose(arg: any) {
        return !isNaN(arg - 0);
    }
    public match(arg: any): arg is number {
        return typeof arg === "number";
    }
    public convert(arg: any) {
        if (!this.matchLoose(arg)) {
            throw new TypeError(`cannot convert ${arg} to number`);
        }

        return arg - 0;
    }
}

export class ObjectMatcher<T extends ObjectOfAll, U extends UnWrapObj<T> = UnWrapObj<T>> extends AbstractMatcher<U> {
    constructor(private token: T) {
        super();
    }
    public matchLoose(arg: any): boolean {
        if (typeof arg !== "object") {
            return false;
        }

        for (let prop in this.token) {
            if (this.token.hasOwnProperty(prop)) {
                let subMatcher = toMatcher(this.token[prop]);

                if (!subMatcher.matchLoose(arg[prop])) {
                    return false;
                }
            }
        }

        return true;
    }

    public match(arg: any): arg is U {
        if (typeof arg !== "object") {
            return false;
        }

        for (let prop in this.token) {
            if (this.token.hasOwnProperty(prop)) {
                let subMatcher = toMatcher(this.token[prop]);

                if (!subMatcher.match(arg[prop])) {
                    return false;
                }
            }
        }

        return true;
    }

    public convert(arg: any): U {
        if (typeof arg !== "object") {
            throw new TypeError(`Expect ${arg} to be object`);
        }

        let res: U = {} as any;

        for (let prop in this.token) {
            if (this.token.hasOwnProperty(prop)) {
                let subMatcher = toMatcher(this.token[prop]);

                try {
                    res[prop] = subMatcher.convert(arg[prop]) as any;
                } catch (err) {
                    const wrappedError = new TypeError(`convert failed on property ${prop} due to\r\n${err.message}`);
                    throw wrappedError;
                }
            }
        }

        return res;
    }
}

export class ArrayMatcher<T extends Array<any>, U extends UnwrapArrayOf<T> = UnwrapArrayOf<T>> extends AbstractMatcher<U> {
    private token: All;
    constructor(type: T) {
        super();
        this.token = type[0];
    }
    public matchLoose(arg: any): boolean {
        if (!Array.isArray(arg)) {
            return false;
        }

        let matcher = toMatcher(this.token);

        for (let i of arg) {
            if (!matcher.matchLoose(i)) {
                return false;
            }
        }

        return true;
    }

    public match(arg: any): arg is U {
        if (!Array.isArray(arg)) {
            return false;
        }

        let matcher = toMatcher(this.token);

        for (let i of arg) {
            if (!matcher.match(i)) {
                return false;
            }
        }

        return true;
    }

    public convert(arg: any): U {
        if (!Array.isArray(arg)) {
            throw new TypeError(`Expect ${arg} to be array`);
        }

        let matcher = toMatcher(this.token);

        return arg.map(function (val, i) {
            try {
                return matcher.convert(val);
            } catch (err) {
                const wrappedError = new TypeError(`convert failed on element ${i} due to\r\n${err.message}`);
                throw wrappedError;
            }
        }) as any;
    }
}

export class ClassMatcher<T extends Construcable<any>, U extends Unwrap<T> = Unwrap<T>> extends AbstractMatcher<U> {
    constructor(private token: T) {
        super();
    }
    public matchLoose(arg: any): boolean {
        return arg instanceof this.token;
    }
    public match(arg: any): arg is U {
        return arg instanceof this.token;
    }
    public convert(arg: any): U {
        if (this.matchLoose(arg)) {
            throw new TypeError(`${arg} is not instance of ${this.token}`);
        }
        return arg;
    }
}

export class ExactMatcher<T extends All> extends AbstractMatcher<T> {
    constructor(private token: T) {
        super();
    }
    public matchLoose(arg: any): boolean {
        // tslint:disable-next-line:triple-equals
        return this.token == arg;
    }
    public match(arg: any): arg is T {
        return this.token === arg;
    }
    public convert(arg: any): T {
        return this.token;
    }
}

export function toMatcher<T extends All>(arg: T): AbstractMatcher<Unwrap<T>> {
    if (arg instanceof AbstractMatcher) {
        return arg;
    }

    if (arg === String) {
        return new StringMatcher as any;
    }

    if (arg === Boolean) {
        return new BooleanMatcher as any;
    }

    if (arg === Number) {
        return new NumberMatcher as any;
    }

    if (Array.isArray(arg)) {
        return new ArrayMatcher(arg) as any;
    }

    if (typeof arg === "object") {
        return new ObjectMatcher(arg as any) as any;
    }

    if (typeof arg === "function") {
        return new ClassMatcher(arg as any) as any;
    }

    return new ExactMatcher(arg) as any;
}

export class OptionalMatcher<T extends All, U extends Unwrap<All> = Unwrap<T>> extends AbstractMatcher<U|undefined> {
    private originalMatcher: AbstractMatcher<Unwrap<T>>;

    constructor(token: T) {
        super();
        this.originalMatcher = toMatcher(token);
    }

    public matchLoose(arg: any): boolean {
        return arg === undefined || this.originalMatcher.matchLoose(arg);
    }

    public match(arg: any): arg is U | undefined {
        return arg === undefined || this.originalMatcher.match(arg);
    }

    public convert(arg: any): U | undefined {
        if (arg === undefined) {
            return undefined;
        } else {
            return this.originalMatcher.convert(arg);
        }
    }
}

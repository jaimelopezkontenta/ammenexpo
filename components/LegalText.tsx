import { Text } from "react-native";

/**
 * Un párrafo legal, con lo que va en negrita en negrita.
 *
 * Los documentos llevan `**así**` porque escribir un legal sin poder destacar
 * "contenido prohibido, sin excepciones" es una forma de que nadie lo lea. No
 * es Markdown ni pretende serlo: parte por `**` y alterna, que es todo lo que
 * hace falta y no trae una librería para dos asteriscos.
 */
export const LegalText = ({ text }: { text: string }) => (
  <Text className="text-base leading-6 text-ink">
    {text.split("**").map((chunk, index) =>
      index % 2 === 1 ? (
        <Text key={index} className="font-semibold">
          {chunk}
        </Text>
      ) : (
        chunk
      ),
    )}
  </Text>
);

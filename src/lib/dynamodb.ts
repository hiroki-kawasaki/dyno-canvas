import {
    DynamoDBClient,
    DynamoDBClientConfig
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";


export function getDynamoClient(useLocal: boolean = false, region?: string, profile?: string) {
    const safeRegion = region || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";

    const config: DynamoDBClientConfig = {
        region: safeRegion,
    };

    if (useLocal) {
        if (process.env.DYNAMODB_ENDPOINT) {
            config.endpoint = process.env.DYNAMODB_ENDPOINT;
        }
        config.credentials = {
            accessKeyId: "local",
            secretAccessKey: "local"
        };
    } else {
        if (profile) {
            config.credentials = fromIni({ profile });
        }
    }

    const client = new DynamoDBClient(config);

    const marshallOptions = {
        convertEmptyValues: false,
        removeUndefinedValues: true,
        convertClassInstanceToMap: false,
    };

    const unmarshallOptions = {
        wrapNumbers: false,
    };

    return DynamoDBDocumentClient.from(client, {
        marshallOptions,
        unmarshallOptions,
    });
}
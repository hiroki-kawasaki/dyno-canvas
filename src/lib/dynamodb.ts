import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";

const clients: Record<string, DynamoDBDocumentClient> = {};

export function getDynamoClient(useLocal: boolean = false, region?: string, profile?: string) {
    const safeRegion = region || process.env.AWS_DEFAULT_REGION || "ap-northeast-1";

    const safeProfile = profile || process.env.AWS_DEFAULT_PROFILE || process.env.AWS_PROFILE;

    const profileKey = !useLocal && safeProfile ? `:${safeProfile}` : '';
    const key = useLocal ? 'local' : `aws:${safeRegion}${profileKey}`;

    if (clients[key]) return clients[key];

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
        if (safeProfile) {
            config.credentials = fromIni({ profile: safeProfile });
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

    const docClient = DynamoDBDocumentClient.from(client, {
        marshallOptions,
        unmarshallOptions,
    });

    clients[key] = docClient;
    return docClient;
}
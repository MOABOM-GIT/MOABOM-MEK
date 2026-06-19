<?php

namespace Modules\Moabom\Apps\Exceptions;

use RuntimeException;

/** 클라이언트가 스트리밍 연결을 끊었거나 사용자가 생성을 중지한 경우 */
class AiStreamCancelledException extends RuntimeException
{
}
